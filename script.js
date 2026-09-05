(() => {
  const GITHUB_USER = 'Sinamajidi';

  const FALLBACK_REPOS = [];

  const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26',
    CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B', C: '#555555', 'C++': '#f34b7d',
    Shell: '#89e051', PHP: '#4F5D95', 'PowerShell': '#012456', 'Arduino': '#bd2c00', 'Makefile': '#427819', 'MATLAB': '#e16737', 'Objective-C': '#438eff', 'Objective-C++': '#6866fb', 'Assembly': '#6E4C13', 'VHDL': '#adb2cb', 'Verilog': '#b2b7f8', 'R': '#198CE7', 'Ruby': '#701516', 'Go': '#00ADD8', 'Rust': '#dea584', 'Kotlin': '#F18E33'
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function repoCard(repo) {
    const li = document.createElement('li');
    li.className = 'repo-card';
    if (repo.language && LANG_COLORS[repo.language]) {
      li.style.setProperty('--lang-color', LANG_COLORS[repo.language]);
    }
    const desc = escapeHtml(repo.description || 'No description yet.');
    const name = escapeHtml(repo.name);
    const lang = escapeHtml(repo.language || '');
    const url = escapeHtml(repo.html_url);
    li.innerHTML = `
      <h3><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></h3>
      <p>${desc}</p>
      <div class="repo-card__meta">
        ${repo.language ? `<span class="repo-card__lang"><span class="repo-card__dot"></span>${lang}</span>` : ''}
        ${repo.fork ? '<span class="repo-card__fork">Forked</span>' : ''}
      </div>`;
    return li;
  }

  function renderRepos(repos) {
    const grid = document.getElementById('repo-grid');
    if (!grid) return;
    grid.innerHTML = '';
    repos.slice(0, 6).forEach(r => grid.appendChild(repoCard(r)));

    // If the page loaded with #funding, section heights just changed above it —
    // re-settle the scroll position now that layout is final.
    if (window.location.hash === '#funding') {
      const target = document.getElementById('funding');
      if (target) target.scrollIntoView({ block: 'start' });
    }
  }

  function renderTags(id, tags, fallback) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    const values = tags.length ? tags : [fallback];
    values.forEach(tag => {
      const item = document.createElement('li');
      item.textContent = tag;
      list.appendChild(item);
    });
  }

  function renderStack(repos, user) {
    const languages = [...new Set(repos.map(repo => repo.language).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    renderTags('github-languages', languages, 'No languages reported yet');
    const stars = repos.reduce((total, repo) => total + (repo.stargazers_count || 0), 0);
    const forks = repos.reduce((total, repo) => total + (repo.forks_count || 0), 0);
    const original = repos.filter(repo => !repo.fork).length;
    const starsStat = document.querySelector('[data-stat="stars"]');
    if (starsStat) starsStat.textContent = stars;
    renderTags('github-signals', [
      `${stars} ${stars === 1 ? 'star' : 'stars'} earned`,
      `${forks} ${forks === 1 ? 'fork' : 'forks'}`,
      `${original} original ${original === 1 ? 'repo' : 'repos'}`,
    ], 'No repository data yet');
    if (user) renderTags('github-profile', [
      `${user.public_repos} public repos`,
      `${user.followers} followers`,
      `${user.following} following`,
    ], 'No profile data yet');
  }

  function extractWallet(readme) {
    const section = readme.match(/##\s+Support my work([\s\S]*?)(?=\n##\s|$)/i)?.[1] || '';
    const address = section.match(/(?:0x[a-f\d]{40}|bc1[a-z0-9]{25,90})/i)?.[0];
    const badge = section.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
    if (!address || !badge) return null;
    const labelLine = section.split('\n').find(line => line.includes(address));
    const label = labelLine
      ?.replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(address, '')
      .replace(/[*#:[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Wallet address';
    return { address, badge, label };
  }

  async function loadWallet(repos) {
    const repo = repos.find(item => item.name.toLowerCase() === GITHUB_USER.toLowerCase());
    if (!repo?.default_branch) return;
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${GITHUB_USER}/${repo.name}/${repo.default_branch}/README.md`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('readme-unavailable');
      const wallet = extractWallet(await res.text());
      if (!wallet) throw new Error('wallet-not-found');
      const container = document.getElementById('wallet');
      const badge = document.getElementById('wallet-badge');
      const label = document.getElementById('wallet-label');
      const address = document.getElementById('wallet-address');
      if (!container || !badge || !label || !address) return;
      badge.src = wallet.badge;
      badge.alt = wallet.label;
      badge.hidden = false;
      label.textContent = wallet.label;
      address.textContent = wallet.address;
      container.hidden = false;
    } catch (err) {
      // Keep the wallet hidden when the profile README cannot be fetched reliably.
    }
  }

  async function loadRepos() {
    try {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&direction=desc&per_page=100`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error('rate-limited-or-unavailable');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
      renderRepos(data);
      renderStack(data, null);
      loadWallet(data);
    } catch (err) {
      renderRepos(FALLBACK_REPOS);
      renderStack([]);
      const note = document.getElementById('repo-note');
      if (note) note.hidden = false;
    }
  }

  async function loadStats() {
    try {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}`);
      if (!res.ok) throw new Error('rate-limited-or-unavailable');
      const user = await res.json();
      const repos = document.querySelector('[data-stat="repos"]');
      const stars = document.querySelector('[data-stat="stars"]');
      const followers = document.querySelector('[data-stat="followers"]');
      if (repos && typeof user.public_repos === 'number') repos.textContent = user.public_repos;
      if (followers && typeof user.followers === 'number') followers.textContent = user.followers;
      const profile = document.getElementById('github-profile');
      if (profile) renderTags('github-profile', [
        `${user.public_repos} public repos`,
        `${user.followers} followers`,
        `${user.following} following`,
      ], 'No profile data yet');
    } catch (err) {
      /* fallback values already in the markup */
    }
  }

  function setupCopyWallet() {
    const btn = document.getElementById('copy-wallet');
    const addr = document.getElementById('wallet-address');
    if (!btn || !addr) return;
    btn.addEventListener('click', async () => {
      const text = addr.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const fallback = document.createElement('textarea');
        fallback.value = text;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        const range = document.createRange();
        window.getSelection().removeAllRanges();
        try {
          window.getSelection().addRange(range);
          navigator.clipboard?.writeText(text);
        } finally {
          fallback.remove();
        }
        window.getSelection().removeAllRanges();
      }
      btn.textContent = btn.dataset.copied;
      setTimeout(() => { btn.textContent = btn.dataset.default; }, 1800);
    });
  }

  function setupSmoothNav() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href').slice(1);

        if (id === 'top') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          history.pushState(null, '', '#top');
          return;
        }

        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', `#${id}`);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadRepos();
    loadStats();
    setupCopyWallet();
    setupSmoothNav();
  });
})();
