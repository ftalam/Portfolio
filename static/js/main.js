(() => {
  'use strict';
  const projects = JSON.parse(document.getElementById('project-data').textContent);
  const capabilities = JSON.parse(document.getElementById('capability-data').textContent);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeProject = projects[0];

  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => { byId(id).textContent = value; };

  const ICONS = window.TOOL_ICONS || {};
  const ALIAS = { 'nasa apis': 'nasa', 'arcgis': 'arcgis', 'web gis': 'web_gis', 'utility networks': 'utility', 'spatial analysis': 'gis_analysis', 'gis analysis': 'gis_analysis', 'remote sensing': 'remote_sensing', 'research': 'research', 'cartography': 'cartography', 'digital earth africa': 'satellite_data', 'javascript': 'javascript', 'react': 'react' };
  function chip(tool) {
    const name = typeof tool === 'string' ? tool : tool.name;
    const key = (typeof tool === 'object' && tool.icon) || ALIAS[name.toLowerCase()];
    const span = document.createElement('span');
    const icon = ICONS[key];
    if (icon) {
      const badge = document.createElement('i');
      badge.style.color = icon.c;
      badge.innerHTML = icon.svg;
      badge.setAttribute('aria-hidden', 'true');
      span.append(badge);
    }
    span.append(document.createTextNode(name));
    return span;
  }

  function selectProject(id, focusPanel = false) {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    activeProject = project;
    document.querySelectorAll('.project-tab').forEach((tab) => {
      const selected = tab.dataset.project === id;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    byId('project-panel').setAttribute('aria-labelledby', `tab-${id}`);
    document.querySelectorAll('.visual-layer').forEach((layer) => { layer.setAttribute('hidden', ''); });
    const layer = document.querySelector(`.visual-${project.visual}`);
    if (layer) layer.removeAttribute('hidden');
    setText('visual-type', project.type.toUpperCase());
    setText('visual-code', project.code ? project.code : project.visual === 'farm' ? 'NDVI / SENTINEL-2' : project.visual === 'grid' ? 'NETWORK / PLANNING' : 'ELEVATION / CHANGE');
    setText('project-year', `${project.year} / SELECTED PROJECT`);
    setText('project-title', project.title);
    setText('project-summary', project.summary);
    if (!reduceMotion) {
      byId('project-panel').animate([{ opacity: .55, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
    }
    if (focusPanel) byId('project-panel').focus({ preventScroll: true });
  }

  const projectTabs = [...document.querySelectorAll('.project-tab')];
  projectTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectProject(tab.dataset.project));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % projectTabs.length;
      if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index - 1 + projectTabs.length) % projectTabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = projectTabs.length - 1;
      projectTabs[next].focus();
      selectProject(projectTabs[next].dataset.project);
    });
  });

  function selectCapability(id) {
    const capability = capabilities.find((item) => item.id === id);
    if (!capability) return;
    document.querySelectorAll('.capability-node').forEach((node) => {
      const selected = node.dataset.capability === id;
      node.classList.toggle('active', selected);
      node.setAttribute('aria-selected', String(selected));
    });
    setText('capability-detail', capability.detail);
    const tools = byId('capability-tools');
    tools.replaceChildren(...capability.tools.map(chip));
  }
  document.querySelectorAll('.capability-node').forEach((node) => node.addEventListener('click', () => selectCapability(node.dataset.capability)));
  selectCapability(capabilities[0].id);

  const dialog = byId('case-dialog');
  byId('open-case').addEventListener('click', () => {
    setText('case-type', activeProject.type.toUpperCase());
    setText('case-title', activeProject.title);
    setText('case-summary', activeProject.summary);
    setText('case-challenge', activeProject.challenge);
    setText('case-approach', activeProject.approach);
    setText('case-outcome', activeProject.outcome);
    const tools = byId('case-tools');
    tools.replaceChildren(...activeProject.tools.map(chip));
    byId('case-link').href = activeProject.link;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
  const closeDialog = () => { dialog.close(); document.body.classList.remove('dialog-open'); };
  byId('close-case').addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  });
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));

  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = byId('mobile-nav');
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    mobileNav.hidden = true;
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
    mobileNav.hidden = open;
  });
  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });

  function updateTime() {
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    setText('nairobi-time', `${time} EAT`);
  }
  updateTime();
  setInterval(updateTime, 1000);
})();
