// Shared browser-test helper: navigation is two-level (area buttons #grp_*, then screen tabs). goTab opens a screen the way a person does.
const tabBtnId = id => id === 'soldiers' ? 'tabSoldiers' : id === 'nav' ? 'tabNav' : id === 'assign' ? 'tabAssign' : 'tab_' + id;
// product-dev6.2: below 900px the area navigation is a drawer (#menuBtn). Open it the way a person does, then use the area button.
async function openNav(p) { if (await p.isVisible('#menuBtn')) { if (!(await p.evaluate(() => document.body.classList.contains('nav-open')))) await p.click('#menuBtn'); await p.waitForFunction(() => getComputedStyle(document.getElementById('grps')).visibility === 'visible'); await p.waitForTimeout(250); } }
async function goTab(p, id) {
  const sel = '#' + tabBtnId(id);
  if (!(await p.isVisible(sel))) { await openNav(p); await p.click('#grps [data-tabs~="' + id + '"]'); if (!(await p.isVisible(sel))) return; }
  await p.click(sel);
}
// every screen id the current user can reach (read from the area buttons, not from the DOM of the open area)
const allTabIds = p => p.$$eval('#grps [data-tabs]', bs => [].concat(...bs.map(b => b.getAttribute('data-tabs').split(' '))));
module.exports = { openNav, goTab, allTabIds, tabBtnId };
