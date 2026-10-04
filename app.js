import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { addDoc, collection, getFirestore, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const scale = ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'];
const groups = [
  { title: '활용 경험', subtitle: '학업 중 생성형 AI를 어떻게 활용하는지 살펴봅니다.', questions: [
    '나는 학업을 위해 생성형 AI를 자주 활용한다.',
    '나는 과제나 발표 자료를 준비할 때 생성형 AI를 활용한다.',
    '나는 수업 내용이나 어려운 개념을 이해하기 위해 생성형 AI를 활용한다.',
    '나는 생성형 AI를 활용해 공부 계획이나 아이디어를 정리한다.'
  ]},
  { title: '학습 도움과 효율', subtitle: '생성형 AI가 학습 과정에 주는 도움을 알아봅니다.', questions: [
    '생성형 AI는 학습 내용을 이해하는 데 도움이 된다.',
    '생성형 AI를 활용하면 과제를 더 효율적으로 수행할 수 있다.',
    '생성형 AI와 대화하면 혼자 공부할 때보다 학습 동기가 높아진다.',
    '생성형 AI는 내가 놓친 관점이나 새로운 아이디어를 발견하는 데 도움이 된다.'
  ]},
  { title: '정보 확인과 의존 우려', subtitle: '정보를 비판적으로 확인하는 습관과 사용에 대한 고민을 알아봅니다.', questions: [
    '생성형 AI가 제공한 정보를 다른 자료와 대조해 확인한다.',
    '생성형 AI의 답변이 틀리거나 부정확할 수 있음을 염두에 둔다.',
    '생성형 AI를 자주 사용하면 스스로 생각하는 시간이 줄어들 수 있다고 걱정한다.',
    '생성형 AI가 없으면 학업을 수행하기 어렵다고 느낄 때가 있다.'
  ]}
];
const questionList = groups.flatMap((group) => group.questions);
let db = null;
let responseRows = [];
let submittedAnswers = null;
const chartColors = ['#26735a', '#739c57', '#d79254', '#647ca0', '#a36b81', '#43a0a1'];

function renderComposition() {
  const dimension = $('composition-by').value;
  const counts = new Map();
  responseRows.forEach((row) => {
    const label = String(row[dimension] || '미입력');
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const entries = [...counts].sort((a, b) => dimension === 'year' ? a[0].localeCompare(b[0], 'ko') : b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  if (!entries.length) {
    $('composition-chart').innerHTML = '<p class="distribution-empty">아직 응답이 없습니다. 첫 응답이 저장되면 인원과 비율이 표시됩니다.</p>';
    return;
  }
  let offset = 0;
  const segments = entries.map(([label, count], index) => {
    const percentage = count / responseRows.length * 100;
    const color = chartColors[index % chartColors.length];
    const arc = `<circle cx="100" cy="100" r="72" fill="none" stroke="${color}" stroke-width="28" pathLength="100" stroke-dasharray="${percentage} ${100 - percentage}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${escapeHtml(label)}: ${count}명 (${percentage.toFixed(1)}%)</title></circle>`;
    offset += percentage;
    return arc;
  }).join('');
  $('composition-chart').innerHTML = `<div class="distribution-layout"><svg viewBox="0 0 200 200" class="donut-chart" role="img" aria-label="전체 ${responseRows.length}명의 응답자 구성 비율. 각 집단 인원과 비율은 옆 목록에서 확인할 수 있습니다.">${segments}<text x="100" y="99" text-anchor="middle" class="donut-total">${responseRows.length}</text><text x="100" y="120" text-anchor="middle" class="donut-caption">전체 응답자</text></svg><div class="distribution-list">${entries.map(([label, count], index) => `<div class="distribution-row"><span><i style="background:${chartColors[index % chartColors.length]}"></i>${escapeHtml(label)}</span><strong>${count}명 <small>${(count / responseRows.length * 100).toFixed(1)}%</small></strong></div>`).join('')}</div></div><p class="distribution-footnote">비율 = 해당 집단 응답 수 ÷ 전체 응답 수 × 100 · 반올림으로 합계가 100%와 조금 다를 수 있습니다. 학교와 기타 전공은 입력한 이름별로 집계합니다.</p>`;
}

function renderPersonalResult() {
  if (!submittedAnswers || !responseRows.length) return;
  const dimensions = [{ title: '활용 경험', indices: [0, 1, 2, 3] }, { title: '학습 도움과 효율', indices: [4, 5, 6, 7] }];
  $('personal-result').hidden = false;
  $('personal-result').innerHTML = `<p class="eyebrow">MY RESPONSE & EVERYONE</p><h3>내 AI 학습 경험은 전체 평균과 어떻게 다를까요?</h3><p>이번에 제출한 내 응답과 전체 응답(${responseRows.length}명, 내 응답 포함)을 비교합니다.</p><div class="personal-grid">${dimensions.map(({ title, indices }) => {
    const own = indices.reduce((sum, index) => sum + submittedAnswers[index], 0) / indices.length;
    const overall = indices.reduce((sum, index) => sum + mean(responseRows, index), 0) / indices.length;
    return `<article><h4>${title}</h4>${[['내 응답', own, '#d79254'], ['전체 평균', overall, '#26735a']].map(([label, score, color]) => `<div class="result-bar-row"><span>${label}</span><div class="result-track"><div class="result-fill" style="width:${score / 5 * 100}%;background:${color}"></div></div><strong>${score.toFixed(2)}</strong></div>`).join('')}<small>각 영역 4문항 평균 · 1~5점</small></article>`;
  }).join('')}</div><p class="distribution-footnote">높고 낮음은 현재 경험과 인식의 차이입니다. 성적이나 AI 활용 능력을 평가하는 점수가 아닙니다.</p>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  window.setTimeout(() => $('toast').classList.remove('show'), 3500);
}

function renderQuestions() {
  let number = 0;
  $('question-groups').innerHTML = groups.map((group, groupIndex) => `
    <section class="question-group">
      <div class="group-heading"><span class="group-index">0${groupIndex + 1}</span><div><h3>${escapeHtml(group.title)}</h3><p>${escapeHtml(group.subtitle)}</p></div></div>
      ${group.questions.map((question) => {
        number += 1;
        const index = number;
        return `<fieldset class="question-item"><legend><span class="question-number">${String(index).padStart(2, '0')}</span><span>${escapeHtml(question)}</span></legend><div class="likert" role="radiogroup" aria-label="${escapeHtml(question)}">${scale.map((label, value) => `<label class="likert-option"><input type="radio" name="q${index}" value="${value + 1}" required><span class="likert-dot">${value + 1}</span><small>${label}</small></label>`).join('')}</div></fieldset>`;
      }).join('')}
    </section>`).join('');
  $('question-groups').querySelectorAll('input[type="radio"]').forEach((input) => input.addEventListener('change', updateProgress));
}

function updateProgress() {
  const answered = questionList.reduce((count, _, index) => count + (document.querySelector(`input[name="q${index + 1}"]:checked`) ? 1 : 0), 0);
  $('progress-count').textContent = String(answered);
  $('progress-ring').style.setProperty('--progress', `${answered / questionList.length * 100}%`);
  $('progress-caption').textContent = answered === questionList.length ? '모든 문항에 응답했어요' : answered ? `${questionList.length - answered}개 문항 남았어요` : '응답을 시작해 보세요';
}

function setStatus(text, kind = '') {
  const pill = $('connection-status');
  pill.className = `status-pill ${kind}`;
  pill.innerHTML = `<i></i>${escapeHtml(text)}`;
}

function mean(rows, questionIndex) {
  const values = rows.map((row) => Number(row.answers?.[questionIndex])).filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function currentRows() {
  const dimension = $('group-by').value;
  const selectedValue = $('group-filter').value;
  return dimension === 'all' || !selectedValue ? responseRows : responseRows.filter((row) => String(row[dimension] ?? '') === selectedValue);
}

function renderFilters() {
  const dimension = $('group-by').value;
  const filter = $('group-filter');
  const label = $('group-filter-label');
  if (dimension === 'all') {
    filter.hidden = true;
    label.hidden = true;
    filter.innerHTML = '<option value="">전체 그룹 비교</option>';
    return;
  }
  const values = [...new Set(responseRows.map((row) => row[dimension]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko'));
  const previous = filter.value;
  filter.hidden = false;
  label.hidden = false;
  const dimensionLabel = { school: '학교', year: '학년', major: '전공 계열' }[dimension];
  label.textContent = `${dimensionLabel} 선택`;
  filter.innerHTML = `<option value="">전체 그룹 비교</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  if (values.includes(previous)) filter.value = previous;
}

function renderChart() {
  const dimension = $('group-by').value;
  const filteredRows = currentRows();
  $('response-count').textContent = responseRows.length.toLocaleString('ko-KR');
  if (!responseRows.length) {
    $('results-chart').innerHTML = `<div class="chart-empty"><div>✳</div><h3>첫 응답을 기다리고 있어요</h3><p>설문에 응답하면 전체 평균과 집단별 비교 결과가 여기에 표시됩니다.</p><a href="#survey-form">설문 참여하기 ↓</a></div>`;
    return;
  }
  const compareGroups = dimension !== 'all' && !$('group-filter').value;
  const values = compareGroups ? [...new Set(responseRows.map((row) => row[dimension]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko')) : [$('group-filter').value || '전체 평균'];
  const series = values.map((name) => {
    const rows = compareGroups ? responseRows.filter((row) => String(row[dimension]) === String(name)) : filteredRows;
    return { name, count: rows.length, averages: questionList.map((_, index) => mean(rows, index)) };
  });
  const colors = ['#26735a', '#739c57', '#d79254', '#647ca0', '#a36b81', '#43a0a1'];
  const bars = groups.map((group) => {
    const start = groups.slice(0, groups.indexOf(group)).reduce((sum, item) => sum + item.questions.length, 0);
    return `<section class="chart-group"><div class="chart-group-title"><span>${escapeHtml(group.title)}</span><small>${group.questions.length}문항</small></div>${group.questions.map((question, localIndex) => {
      const index = start + localIndex;
      const chartSeries = series.map((item, seriesIndex) => ({ ...item, score: item.averages[index], color: colors[seriesIndex % colors.length] })).filter((item) => item.score !== null);
      return `<div class="result-question"><div class="result-question-title"><span><b>${String(index + 1).padStart(2, '0')}</b> ${escapeHtml(question)}</span>${chartSeries.length === 1 ? `<strong>${chartSeries[0].score.toFixed(2)}<small> / 5</small></strong>` : ''}</div><div class="result-bars">${chartSeries.map((item) => `<div class="result-bar-row"><span class="result-bar-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><div class="result-track"><div class="result-fill" style="width:${item.score / 5 * 100}%;background:${item.color}"></div></div><strong>${item.score.toFixed(2)}</strong></div>`).join('') || '<small class="no-values">아직 이 문항에 대한 응답이 없습니다.</small>'}</div></div>`;
    }).join('')}</section>`;
  }).join('');
  const legend = compareGroups ? `<div class="chart-legend">${series.map((item, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.name)} <small>n=${item.count}</small></span>`).join('')}</div>` : `<div class="chart-legend"><span><i style="background:${colors[0]}"></i>${escapeHtml(series[0]?.name ?? '전체 평균')} <small>n=${filteredRows.length}</small></span></div>`;
  const heading = { all: '전체 문항 평균', school: '학교별 문항 평균 비교', year: '학년별 문항 평균 비교', major: '전공 계열별 문항 평균 비교' }[dimension];
  $('results-chart').innerHTML = `<div class="chart-top"><div><p class="eyebrow">AVERAGE SCORE · 1—5</p><h3>${heading}</h3><p>집단마다 응답 인원이 달라요. 표본 수를 함께 살펴보세요.</p></div><span class="chart-count">${filteredRows.length.toLocaleString('ko-KR')}명${$('group-filter').value ? ' 선택됨' : ''}</span></div>${legend}<div class="average-axis" aria-label="막대 길이 기준: 0에서 5점"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5점</span></div>${bars}`;
}

function renderResults() {
  renderFilters();
  renderChart();
  renderComposition();
  renderPersonalResult();
}

function validateProfile() {
  const school = $('school').value.trim().replace(/\s+/g, ' ');
  $('school').value = school;
  const otherSelected = $('major').value === '기타';
  const majorOther = $('major-other').value.trim().replace(/\s+/g, ' ');
  $('major-other').value = majorOther;
  if (otherSelected && !majorOther) {
    $('major-other').setCustomValidity('전공 계열을 입력해 주세요.');
    $('major-other').reportValidity();
    return null;
  }
  $('major-other').setCustomValidity('');
  if (!school) {
    $('school').setCustomValidity('학교 이름을 입력해 주세요.');
    $('school').reportValidity();
    return null;
  }
  $('school').setCustomValidity('');
  return { school, year: $('year').value, major: otherSelected ? majorOther : $('major').value };
}

async function submitResponse(event) {
  event.preventDefault();
  const profile = validateProfile();
  if (!profile) return;
  const form = $('survey-form');
  if (!form.reportValidity()) {
    const firstMissing = form.querySelector(':invalid');
    firstMissing?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!db) {
    $('form-message').textContent = 'Firebase가 연결되지 않아 응답을 저장할 수 없습니다. Firebase 설정을 완료한 뒤 다시 시도해 주세요.';
    $('form-message').className = 'form-message error';
    return;
  }
  const answers = questionList.map((_, index) => Number(form.querySelector(`input[name="q${index + 1}"]:checked`).value));
  const button = $('submit-button');
  button.disabled = true;
  button.innerHTML = '응답 저장 중…';
  $('form-message').textContent = '';
  try {
    await addDoc(collection(db, 'responses'), { ...profile, answers, createdAt: serverTimestamp() });
    submittedAnswers = [...answers];
    renderPersonalResult();
    $('form-message').textContent = '응답이 저장되었습니다. 아래 실시간 결과에서 전체 응답과 집단별 평균을 확인해 보세요.';
    $('form-message').className = 'form-message success';
    form.reset();
    $('major-other-wrap').hidden = true;
    $('major-other').required = false;
    updateProgress();
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('Response save failed:', error);
    $('form-message').textContent = '응답 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    $('form-message').className = 'form-message error';
  } finally {
    button.disabled = false;
    button.innerHTML = '응답 제출하기 <span>→</span>';
  }
}

function connectFirebase() {
  const config = window.PEOPLELENS_FIREBASE_CONFIG;
  if (!config?.apiKey || !config?.projectId || String(config.apiKey).startsWith('YOUR_')) {
    setStatus('Firebase 설정이 필요합니다', 'error');
    $('results-chart').innerHTML = '<div class="chart-empty"><div>⚙</div><h3>Firebase 웹 설정이 아직 연결되지 않았어요</h3><p>firebase-config.js에 Firebase 프로젝트의 웹 앱 설정을 입력하면 응답 저장과 실시간 결과가 작동합니다.</p></div>';
    $('response-count').textContent = '0';
    return;
  }
  try {
    db = getFirestore(initializeApp(config));
    setStatus('응답 결과 연결 중');
    onSnapshot(collection(db, 'responses'), { includeMetadataChanges: true }, (snapshot) => {
      responseRows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row) => Array.isArray(row.answers) && row.answers.length === questionList.length && row.answers.every((value) => Number.isInteger(value) && value >= 1 && value <= 5));
      setStatus(snapshot.metadata.fromCache ? '저장된 결과 표시 중 · 연결 확인 중' : '실시간 응답 결과 연결됨');
      renderResults();
    }, (error) => {
      console.error('Responses subscription failed:', error);
      setStatus('응답 데이터를 불러오지 못했습니다', 'error');
      $('results-chart').innerHTML = '<div class="chart-empty"><div>!</div><h3>결과를 불러오지 못했어요</h3><p>Firestore 데이터베이스와 보안 규칙을 확인해 주세요.</p></div>';
    });
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    setStatus('Firebase 초기화에 실패했습니다', 'error');
  }
}

renderQuestions();
$('survey-form').addEventListener('change', (event) => {
  if (event.target.id === 'major') {
    const showOther = event.target.value === '기타';
    $('major-other-wrap').hidden = !showOther;
    $('major-other').required = showOther;
    if (!showOther) $('major-other').value = '';
  }
});
$('survey-form').addEventListener('submit', submitResponse);
$('survey-form').addEventListener('input', (event) => {
  if (event.target.id === 'school' || event.target.id === 'major-other') event.target.setCustomValidity('');
});
$('composition-by').addEventListener('change', renderComposition);
$('group-by').addEventListener('change', () => { $('group-filter').value = ''; renderResults(); });
$('group-filter').addEventListener('change', renderChart);
connectFirebase();
