const STORAGE_KEY = 'energysense-campus-data';
const APP_KEY = 'energysense-app-state';
const defaultData = { campusName: '', students: 5000, area: 25000, monthlyEnergy: 48000, energyCost: 0.16, renewable: 12 };
let campus = loadData();
let appState = loadAppState();
let charts = {};
let twinReductionOverride = null;
const $ = (id) => document.getElementById(id);

function loadData() { try { return { ...defaultData, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; } catch { return { ...defaultData }; } }
function loadAppState() { try { return { userName: '', months: [], challenge: 0, challengeAccepted: false, ...(JSON.parse(localStorage.getItem(APP_KEY)) || {}) }; } catch { return { userName: '', months: [], challenge: 0, challengeAccepted: false }; } }
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(campus)); $('lastSaved').textContent = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; }
function saveAppState() { localStorage.setItem(APP_KEY, JSON.stringify(appState)); }
function number(value, digits = 0) { return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits }); }
function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function calculate() {
  const energy = Number(campus.monthlyEnergy) || 0;
  const area = Number(campus.area) || 1;
  const renewable = Number(campus.renewable) || 0;
  const co2 = energy * 0.42 * (1 - renewable / 100);
  const cost = energy * (Number(campus.energyCost) || 0);
  const intensity = energy / area;
  const score = Math.max(0, Math.min(100, Math.round(100 - intensity * 0.62 + renewable * .45)));
  return { energy, area, renewable, co2, cost, intensity, score };
}
function setForm() { Object.keys(defaultData).forEach(key => { if ($(key)) $(key).value = campus[key] || ''; }); }
function render() {
  const m = calculate();
  const title = campus.campusName || 'Your campus';
  $('dashboardTitle').textContent = `${title} at a glance`;
  $('updatedChip').textContent = campus.campusName ? 'Baseline calculated' : 'Demo baseline';
  $('scoreValue').textContent = m.score; $('heroScore').textContent = m.score;
  $('scoreBar').style.width = `${m.score}%`; $('scoreRing').style.background = `conic-gradient(#8dd3a8 ${m.score * 3.6}deg, rgba(255,255,255,.17) 0deg)`;
  $('scoreMessage').textContent = m.score >= 75 ? 'A strong foundation. Keep building on it.' : m.score >= 50 ? 'Good start. A few focused changes can lift this.' : 'There is room to make a meaningful difference.';
  $('energyValue').textContent = number(m.energy); $('co2Value').textContent = number(m.co2); $('costValue').textContent = money(m.cost);
  $('co2Cars').textContent = `${number(m.co2 / 4.6)} car trips`;
  $('costTrack').style.width = `${Math.min(100, m.cost / 1000)}%`;
  $('energyTrend').textContent = `~${number(m.intensity, 1)} kWh per m²`; $('costTrend').textContent = `${money(m.cost * 12)} estimated yearly`;
  $('beforeEnergy').textContent = `${number(m.energy)} kWh`; $('beforeCarbon').textContent = `${number(m.co2)} kg`; $('beforeCost').textContent = money(m.cost);
  createCharts(m); renderRecommendations(m); renderIntelligence(m); renderHistory(); renderMomentum(m); simulate();
}
function chartDefaults() { return { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#17342a', padding: 10, displayColors: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#91a098', font: { size: 10 } } }, y: { grid: { color: '#edf2ee' }, ticks: { color: '#91a098', font: { size: 10 } }, border: { display: false } } } }; }
function destroyCharts() { Object.values(charts).forEach(chart => chart?.destroy()); charts = {}; }
function createCharts(m) {
  destroyCharts();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const variation = [1.08,.98,1.02,.91,.88,.94,1.06,1.1,.99,.93,.96,1.04];
  const count = Number($('chartPeriod').value); const savedMonths = appState.months.slice().sort((a,b) => a.month.localeCompare(b.month)).slice(-count); const labels = savedMonths.length ? savedMonths.map(item => item.month) : months.slice(12 - count); const values = savedMonths.length ? savedMonths.map(item => Number(item.energy)) : variation.slice(12 - count).map(v => Math.round(m.energy * v));
  charts.consumption = new Chart($('consumptionChart'), { type:'line', data:{ labels, datasets:[{ data:values, borderColor:'#147c54', backgroundColor:'rgba(20,124,84,.09)', fill:true, tension:.42, pointRadius:3, pointBackgroundColor:'#fff', pointBorderColor:'#147c54', pointBorderWidth:2 }] }, options:chartDefaults() });
  const allocation = [38,27,18,10,7]; const colors = ['#147c54','#5e9cc2','#de8760','#d8aa48','#b7c8bd'];
  charts.allocation = new Chart($('allocationChart'), { type:'doughnut', data:{ labels:['HVAC','Lighting','Plug loads','Water heating','Other'], datasets:[{ data:allocation, backgroundColor:colors, borderWidth:3, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'73%', plugins:{ legend:{display:false} } } });
  $('topUsePercent').textContent = `${allocation[0]}%`; $('allocationLegend').innerHTML = allocation.map((v,i) => `<div class="legend-item"><i style="background:${colors[i]}"></i>${['HVAC','Lighting','Plug loads','Water heating','Other'][i]} <b>${v}%</b></div>`).join('');
  charts.mini = new Chart($('miniEnergyChart'), { type:'line', data:{ labels:['','','','','',''], datasets:[{ data:[.9,1.04,.97,1.08,.94,1], borderColor:'#5e9cc2', borderWidth:2, tension:.4, pointRadius:0 }] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false}}} });
  const future = months.map((_,i) => Math.round(m.energy * (1 + (i * .006)))); const reduction = Math.max(5, Math.round(8 + m.renewable * .12)); const better = future.map(v => Math.round(v * (1 - reduction / 100)));
  charts.prediction = new Chart($('predictionChart'), { type:'line', data:{ labels:months, datasets:[{data:future,borderColor:'#b8c6bd',borderDash:[5,5],borderWidth:2,tension:.35,pointRadius:0},{data:better,borderColor:'#147c54',borderWidth:2,tension:.35,pointRadius:0,fill:true,backgroundColor:'rgba(20,124,84,.08)'}] }, options:chartDefaults() });
  $('predictionPercent').textContent = `${reduction}%`; $('annualSavings').textContent = `${money(m.cost * 12 * reduction / 100)} / year potential`;
}
function renderRecommendations(m) {
  const recs = m.intensity > 2 ? [['↯','Tune HVAC schedules','HVAC is typically your largest load. Smarter schedules could save up to 12%.']] : [['✦','Protect your strong baseline','Your energy intensity is already efficient. Focus on renewable generation next.']];
  if (m.renewable < 20) recs.push(['☼','Grow your clean energy','A 10% increase in renewable share could avoid more carbon each month.']);
  recs.push(['◌','Make lighting work harder','LED upgrades are a visible, low-disruption win for most campuses.']);
  $('recommendations').innerHTML = recs.slice(0,3).map(r => `<div class="recommendation"><div class="rec-icon">${r[0]}</div><div><strong>${r[1]}</strong><p>${r[2]}</p></div></div>`).join('');
}
function renderIntelligence(m) {
  const items = m.intensity > 2.2 ? [['1','HVAC scheduling','Highest likely impact','12–18%'],['2','LED lighting audit','Fast payback opportunity','6–10%'],['3','Renewable expansion','Long-term carbon lever',m.renewable < 20 ? 'High' : 'Medium']] : [['1','Renewable expansion','Best remaining lever',m.renewable < 20 ? 'High' : 'Medium'],['2','After-hours lighting','Easy operational win','4–8%'],['3','Plug-load policy','Low-cost behavior change','2–5%']];
  if ($('advisorMessage')) $('advisorMessage').textContent = `Based on ${number(m.intensity, 1)} kWh per m² and ${m.renewable}% renewable coverage, these actions deserve attention first.`;
  $('priorityRecommendations').innerHTML = items.map(item => `<div class="priority-item"><b>${item[0]}</b><div><strong>${item[1]}</strong><small>${item[2]}</small></div><span>${item[3]}</span></div>`).join('');
  const findings = m.intensity > 2 ? [['After-hours load','Your baseline suggests a possible overnight load pocket. Review schedules.','High'],['Cooling drift','HVAC may be carrying the largest avoidable share during mild periods.','Medium']] : [['Standby draw','Small plug loads can accumulate when spaces are unoccupied.','Medium'],['Lighting overlap','Check whether daylight and electric lighting are working together.','Low']];
  $('wasteScore').textContent = m.intensity > 2 ? '2 signals' : '2 signals'; $('wasteFindings').innerHTML = findings.map(f => `<div class="waste-finding"><span class="finding-dot ${f[2].toLowerCase()}"></span><div><strong>${f[0]}</strong><small>${f[1]}</small></div><em>${f[2]}</em></div>`).join('');
}
function renderHistory() {
  const list = $('historyList'); if (!list) return;
  list.innerHTML = appState.months.length ? appState.months.slice().sort((a,b) => b.month.localeCompare(a.month)).map(item => `<div class="history-row"><span>${item.month}</span><strong>${number(item.energy)} kWh</strong><button data-month="${item.month}" aria-label="Remove ${item.month}">×</button></div>`).join('') : '<p class="empty-history">No monthly records yet. Add your first month above.</p>';
  list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { appState.months = appState.months.filter(item => item.month !== button.dataset.month); saveAppState(); renderHistory(); toast('Monthly record removed'); }));
}
function renderMomentum(m) {
  const completed = appState.challenge || 0; const progress = appState.challengeAccepted ? Math.max(completed, Math.min(100, Math.round((m.score / 100) * 70))) : 0;
  if ($('challengeProgress')) $('challengeProgress').style.width = `${progress}%`; if ($('challengeBar')) $('challengeBar').style.width = `${progress}%`; if ($('challengeStatus')) $('challengeStatus').textContent = `${progress}% complete`; if ($('challengeProgressText')) $('challengeProgressText').textContent = `${Math.round(progress / 100 * 3)} / 3 buildings`;
  const badges = [{ icon:'◒', name:'Baseline builder', earned:appState.months.length > 0 || Boolean(campus.campusName) },{ icon:'↯', name:'Data keeper', earned:appState.months.length >= 3 },{ icon:'✦', name:'Green thinker', earned:m.score >= 70 },{ icon:'☼', name:'Challenge accepted', earned:appState.challengeAccepted }];
  if ($('badgeCount')) $('badgeCount').textContent = `${badges.filter(b => b.earned).length} / ${badges.length}`;
  if ($('badges')) $('badges').innerHTML = badges.map(b => `<div class="badge ${b.earned ? 'earned' : ''}"><span>${b.icon}</span><strong>${b.name}</strong><small>${b.earned ? 'Unlocked' : 'Locked'}</small></div>`).join('');
}
function simulate() {
  const m = calculate(); const lighting = Number($('lightingRange').value), hvac = Number($('hvacRange').value), solar = Number($('solarRange').value); const saving = twinReductionOverride === null ? Math.min(70, lighting * .35 + hvac * .55 + solar) : twinReductionOverride;
  $('lightingOutput').textContent = `${lighting}%`; $('hvacOutput').textContent = `${hvac}%`; $('solarOutput').textContent = `${solar}%`; $('savingPercent').textContent = `${saving.toFixed(1)}%`;
  const saved = m.energy * saving / 100, after = m.energy - saved; $('energySaved').textContent = `${number(saved)} kWh`; $('moneySaved').textContent = money(saved * (Number(campus.energyCost) || 0)); $('carbonSaved').textContent = `${number(saved * .42)} kg`; if ($('scoreSaved')) $('scoreSaved').textContent = `+${Math.round(saving * .25)} points`;
  $('afterEnergy').textContent = `${number(after)} kWh`; $('afterCarbon').textContent = `${number(m.co2 - saved * .42)} kg`; $('afterCost').textContent = money(m.cost - saved * (Number(campus.energyCost) || 0));
  $('energyProgress').style.width = `${100 - saving}%`; $('carbonProgress').style.width = `${Math.max(0, 100 - saving)}%`; $('costProgress').style.width = `${Math.max(0, 100 - saving)}%`;
}
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2400); }
$('campusForm').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.target); campus = Object.fromEntries(form.entries()); campus.students = Number(campus.students); campus.area = Number(campus.area); campus.monthlyEnergy = Number(campus.monthlyEnergy); campus.energyCost = Number(campus.energyCost); campus.renewable = Number(campus.renewable); saveData(); render(); toast('Baseline calculated and saved locally'); location.hash = 'analysis'; });
['lightingRange','hvacRange','solarRange'].forEach(id => $(id).addEventListener('input', () => { twinReductionOverride = null; document.querySelectorAll('.twin-presets button').forEach(item => item.classList.remove('active')); simulate(); }));
$('resetSimulation').addEventListener('click', () => { twinReductionOverride = null; ['lightingRange','hvacRange','solarRange'].forEach(id => $(id).value = 0); document.querySelectorAll('.twin-presets button').forEach(item => item.classList.remove('active')); simulate(); });
$('chartPeriod').addEventListener('change', () => createCharts(calculate()));
document.querySelectorAll('.twin-presets button').forEach(button => button.addEventListener('click', () => { const reduction = Number(button.dataset.reduction); twinReductionOverride = reduction; $('lightingRange').value = Math.round(reduction * .6); $('hvacRange').value = Math.round(reduction * .4); $('solarRange').value = 0; simulate(); document.querySelectorAll('.twin-presets button').forEach(item => item.classList.toggle('active', item === button)); }));
$('demoData').addEventListener('click', () => { campus = { campusName:'Northbridge University', students:8400, area:62000, monthlyEnergy:118000, energyCost:.16, renewable:14 }; setForm(); saveData(); render(); toast('Demo campus loaded'); location.hash='analysis'; });
$('printReport').addEventListener('click', () => window.print()); $('printTop').addEventListener('click', () => window.print());
$('clearData').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); campus={...defaultData}; setForm(); render(); toast('Saved data cleared'); });
$('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => $('sidebar').classList.remove('open')));
function closeWelcome() { $('welcomeScreen').classList.add('hidden'); }
if ($('welcomeForm')) $('welcomeForm').addEventListener('submit', event => { event.preventDefault(); appState.userName = $('userName').value.trim(); saveAppState(); closeWelcome(); toast(`Welcome${appState.userName ? `, ${appState.userName}` : ''}`); });
$('enterApp').addEventListener('click', () => { closeWelcome(); });
$('welcomeDemo').addEventListener('click', () => { campus = { campusName:'Northbridge University', students:8400, area:62000, monthlyEnergy:118000, energyCost:.16, renewable:14 }; setForm(); saveData(); closeWelcome(); render(); toast('Demo campus loaded'); location.hash='analysis'; });
if (appState.userName || localStorage.getItem(STORAGE_KEY)) closeWelcome();
$('monthlyForm').addEventListener('submit', event => { event.preventDefault(); const month = $('monthName').value; const energy = Number($('monthEnergy').value); appState.months = appState.months.filter(item => item.month !== month).concat({ month, energy }); saveAppState(); event.target.reset(); renderHistory(); renderMomentum(calculate()); toast('Monthly energy record saved'); });
const challengeButton = $('acceptChallenge') || $('completeChallenge'); if (challengeButton) challengeButton.addEventListener('click', () => { appState.challengeAccepted = true; appState.challenge = 100; saveAppState(); renderMomentum(calculate()); toast('Challenge accepted. Your progress is underway.'); });
setForm(); render();
