/* =============================================
   MARKMASTER — Paper Marking System
   script.js
   ============================================= */

const STORAGE_KEY = 'coolMarksApp';
const GRADES_KEY  = 'coolMarksApp_grades';

let students = [];
let editingId = null;
let deleteId  = null;
let searchQuery = '';
let showTop10 = false;
let sortByRank = false;
let gradeBoundaries = {
  A: 150,
  B: 120,
  C: 100,
  D: 70
};

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  students = raw ? JSON.parse(raw) : [];

  const gradesRaw = localStorage.getItem(GRADES_KEY);
  if (gradesRaw) {
    gradeBoundaries = JSON.parse(gradesRaw);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  localStorage.setItem(GRADES_KEY, JSON.stringify(gradeBoundaries));
}

function genId() {
  return '_' + Math.random().toString(36).slice(2, 10);
}

function getGrade(total) {
  if (total >= gradeBoundaries.A) return 'A';
  if (total >= gradeBoundaries.B) return 'B';
  if (total >= gradeBoundaries.C) return 'C';
  if (total >= gradeBoundaries.D) return 'D';
  return 'F';
}

function getSorted(list) {
  return [...list].sort((a, b) => {
    if (sortByRank) {
      const totalA = typeof a.total === 'number' ? a.total : 0;
      const totalB = typeof b.total === 'number' ? b.total : 0;
      if (totalB !== totalA) return totalB - totalA;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }

    const indexA = a.index || '';
    const indexB = b.index || '';
    if (!indexA && !indexB) return 0;
    if (!indexA) return 1;
    if (!indexB) return -1;
    return indexA.localeCompare(indexB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function getVisibleStudents() {
  let sorted = getSorted(students);
  if (showTop10) sorted = sorted.slice(0, 10);

  const query = searchQuery.toLowerCase().trim();
  return query
    ? sorted.filter(s =>
        s.nic.toLowerCase().includes(query) ||
        s.index.toLowerCase().includes(query) ||
        s.barcode.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.school.toLowerCase().includes(query)
      )
    : sorted;
}

function totalClass(total) {
  if (total >= gradeBoundaries.B) return 'total-high';
  if (total >= gradeBoundaries.D) return 'total-mid';
  return 'total-low';
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');

  const filtered = getVisibleStudents();
  tbody.innerHTML = '';

  if (students.length === 0) {
    emptyState.classList.add('show');
    return;
  }
  emptyState.classList.remove('show');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:48px;color:var(--text3);">
          <i class="fas fa-search" style="margin-right:8px;"></i>
          No students match "<strong>${searchQuery}</strong>"
        </td>
      </tr>`;
    return;
  }

  filtered.forEach((student, idx) => {
    const totCls = totalClass(student.total);
    const animDelay = idx * 40;
    const tr = document.createElement('tr');
    tr.style.animationDelay = `${animDelay}ms`;
    tr.innerHTML = `
      <td><span class="index-badge">${escHtml(student.nic)}</span></td>
      <td><span class="index-badge">${escHtml(student.index)}</span></td>
      <td><span class="index-badge">${escHtml(student.barcode)}</span></td>
      <td><span class="student-name">${escHtml(student.name)}</span></td>
      <td>${escHtml(student.school)}</td>
      <td class="mark-cell"><span class="mark-value">${student.part1}</span></td>
      <td class="mark-cell"><span class="mark-value">${student.part2}</span></td>
      <td class="total-cell"><span class="total-value ${totCls}">${student.total}</span></td>
      <td class="actions-cell">
        <div class="action-wrap">
          <button class="action-btn action-edit" title="Edit" onclick="openEditModal('${student.id}')">
            <i class="fas fa-pen"></i>
          </button>
          <button class="action-btn action-delete" title="Delete" onclick="openDeleteModal('${student.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateStats();
}

function updateStats() {
  const count = students.length;
  const totals = students.map(s => s.total);
  const highest = count ? Math.max(...totals) : null;
  const lowest  = count ? Math.min(...totals) : null;
  const avg     = count ? (totals.reduce((a, b) => a + b, 0) / count).toFixed(1) : null;

  document.getElementById('studentCount').textContent = count;
  document.getElementById('statTotal').textContent    = count;
  document.getElementById('statHighest').textContent  = highest ?? '—';
  document.getElementById('statLowest').textContent   = lowest  ?? '—';
  document.getElementById('statAvg').textContent      = avg     ?? '—';
  document.getElementById('topScore').textContent     = highest ?? '—';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  clearModalErrors();
  resetForm();
  editingId = null;
}

function openDeleteOverlay() {
  document.getElementById('deleteOverlay').classList.add('open');
}

function closeDeleteOverlay() {
  document.getElementById('deleteOverlay').classList.remove('open');
  deleteId = null;
}

function openGradesModal() {
  document.getElementById('gradeAInput').value = gradeBoundaries.A;
  document.getElementById('gradeBInput').value = gradeBoundaries.B;
  document.getElementById('gradeCInput').value = gradeBoundaries.C;
  document.getElementById('gradeDInput').value = gradeBoundaries.D;
  updateBoundariesDisplay();
  document.getElementById('gradesOverlay').classList.add('open');
}

function closeGradesModal() {
  document.getElementById('gradesOverlay').classList.remove('open');
}

function updateBoundariesDisplay() {
  const display = document.getElementById('boundariesDisplay');
  display.innerHTML = `
    <div class="boundary-item"><strong>A:</strong> ${gradeBoundaries.A}+</div>
    <div class="boundary-item"><strong>B:</strong> ${gradeBoundaries.B}+</div>
    <div class="boundary-item"><strong>C:</strong> ${gradeBoundaries.C}+</div>
    <div class="boundary-item"><strong>D:</strong> ${gradeBoundaries.D}+</div>
  `;
}

function applyGradeBoundaries() {
  const aValue = parseInt(document.getElementById('gradeAInput').value, 10);
  const bValue = parseInt(document.getElementById('gradeBInput').value, 10);
  const cValue = parseInt(document.getElementById('gradeCInput').value, 10);
  const dValue = parseInt(document.getElementById('gradeDInput').value, 10);

  if ([aValue, bValue, cValue, dValue].some(v => Number.isNaN(v) || v < 0)) {
    showToast('Enter valid grade boundaries.', true);
    return;
  }
  if (!(aValue > bValue && bValue > cValue && cValue > dValue)) {
    showToast('Boundaries must descend in order A > B > C > D.', true);
    return;
  }

  gradeBoundaries = { A: aValue, B: bValue, C: cValue, D: dValue };
  saveData();
  updateBoundariesDisplay();
  renderTable();
  showToast('Grade boundaries updated.');
}

function toggleSortView() {
  sortByRank = !sortByRank;
  const sortButton = document.getElementById('sortViewBtn');
  sortButton.innerHTML = sortByRank
    ? '<i class="fas fa-sort-numeric-down"></i> Sort by Index'
    : '<i class="fas fa-sort"></i> Sort by Rank';
  renderTable();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function exportXML() {
  if (students.length === 0) {
    showToast('No students to export!', true);
    return;
  }

  const rows = getVisibleStudents().map(student => `
    <student>
      <nicNo>${escapeXml(student.nic)}</nicNo>
      <indexNo>${escapeXml(student.index)}</indexNo>
      <barcodeNo>${escapeXml(student.barcode)}</barcodeNo>
      <name>${escapeXml(student.name)}</name>
      <school>${escapeXml(student.school)}</school>
      <part1Marks>${student.part1}</part1Marks>
      <part2Marks>${student.part2}</part2Marks>
      <total>${student.total}</total>
    </student>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<students>${rows}\n</students>`;
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marks_${sortByRank ? 'rank' : 'index'}_${new Date().toISOString().slice(0,10)}.xml`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('XML exported using current sort state!');
}

function exportCSV() {
  if (students.length === 0) {
    showToast('No students to export!', true);
    return;
  }

  const visible = getVisibleStudents();

  const header = ['NIC No', 'Index No.', 'Barcode No', 'Name', 'School', 'Part 1 Marks', 'Part 2 Marks', 'Total'];
  const rows = visible.map(student => [
    student.nic,
    student.index,
    student.barcode,
    student.name,
    student.school,
    student.part1,
    student.part2,
    student.total
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marks_${sortByRank ? 'rank' : 'index'}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported using current sort state!');
}

function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Student';
  document.getElementById('saveBtnText').textContent = 'Add Student';
  document.getElementById('modalIcon').className = 'fas fa-user-plus';
  resetForm();
  openModal();
  setTimeout(() => document.getElementById('inputNIC').focus(), 200);
}

function openEditModal(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Student';
  document.getElementById('saveBtnText').textContent = 'Save Changes';
  document.getElementById('modalIcon').className = 'fas fa-user-pen';

  document.getElementById('inputNIC').value = student.nic;
  document.getElementById('inputIndex').value = student.index;
  document.getElementById('inputBarcode').value = student.barcode;
  document.getElementById('inputName').value = student.name;
  document.getElementById('inputSchool').value = student.school;
  document.getElementById('inputPart1').value = student.part1;
  document.getElementById('inputPart2').value = student.part2;

  updatePreview();
  openModal();
  setTimeout(() => document.getElementById('inputName').focus(), 200);
}

function openDeleteModal(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;
  deleteId = id;
  document.getElementById('deleteStudentName').textContent = student.name;
  openDeleteOverlay();
}

function resetForm() {
  ['inputNIC','inputIndex','inputBarcode','inputName','inputSchool','inputPart1','inputPart2'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  ['errNIC','errIndex','errBarcode','errName','errSchool','errPart1','errPart2'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  document.getElementById('previewTotal').textContent = '—';
  document.getElementById('previewTotal').style.color = 'var(--cyan)';
  document.getElementById('previewGrade').textContent = '';
  document.getElementById('previewGrade').className = 'preview-grade';
}

function validateForm() {
  clearModalErrors();
  const nic = document.getElementById('inputNIC').value.trim();
  const index = document.getElementById('inputIndex').value.trim();
  const barcode = document.getElementById('inputBarcode').value.trim();
  const name = document.getElementById('inputName').value.trim();
  const school = document.getElementById('inputSchool').value.trim();
  const part1V = document.getElementById('inputPart1').value;
  const part2V = document.getElementById('inputPart2').value;
  const part1 = part1V === '' ? 0 : parseFloat(part1V);
  const part2 = part2V === '' ? 0 : parseFloat(part2V);
  let valid = true;

  function setErr(inputId, errId, msg) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errId).textContent = msg;
    valid = false;
  }

  if (index && students.some(s => s.index === index && s.id !== editingId)) {
    setErr('inputIndex', 'errIndex', 'This index already exists.');
  }

  if (part1V !== '' && (isNaN(part1) || part1 < 0)) {
    setErr('inputPart1', 'errPart1', 'Enter a valid number ≥ 0.');
  }

  if (part2V !== '' && (isNaN(part2) || part2 < 0)) {
    setErr('inputPart2', 'errPart2', 'Enter a valid number ≥ 0.');
  }

  return valid;
}

function updatePreview() {
  const part1 = parseFloat(document.getElementById('inputPart1').value) || 0;
  const part2 = parseFloat(document.getElementById('inputPart2').value) || 0;
  const total = part1 + part2;

  const previewEl = document.getElementById('previewTotal');
  const gradeEl = document.getElementById('previewGrade');

  if (document.getElementById('inputPart1').value === '' && document.getElementById('inputPart2').value === '') {
    previewEl.textContent = '—';
    previewEl.style.color = 'var(--cyan)';
    gradeEl.textContent = '';
    gradeEl.className = 'preview-grade';
    return;
  }

  previewEl.textContent = total;
  const grade = getGrade(total);
  const colorMap = { A:'var(--green)', B:'var(--blue)', C:'var(--gold)', D:'var(--red)', F:'var(--text3)' };
  previewEl.style.color = colorMap[grade];
  gradeEl.textContent = grade;
  gradeEl.className = `preview-grade grade-badge grade-${grade}`;
}

function saveStudent() {
  if (!validateForm()) return;

  const nic = document.getElementById('inputNIC').value.trim();
  const index = document.getElementById('inputIndex').value.trim();
  const barcode = document.getElementById('inputBarcode').value.trim();
  const name = document.getElementById('inputName').value.trim();
  const school = document.getElementById('inputSchool').value.trim();
  const part1 = parseFloat(document.getElementById('inputPart1').value) || 0;
  const part2 = parseFloat(document.getElementById('inputPart2').value) || 0;
  const total = part1 + part2;

  if (editingId !== null) {
    const idx = students.findIndex(s => s.id === editingId);
    if (idx !== -1) {
      students[idx] = { ...students[idx], nic, index, barcode, name, school, part1, part2, total };
    }
    showToast('Student updated successfully!');
  } else {
    students.push({ id: genId(), nic, index, barcode, name, school, part1, part2, total });
    showToast('Student added successfully!');
  }

  saveData();
  renderTable();
  closeModal();
}

function deleteStudent() {
  if (deleteId === null) return;
  students = students.filter(s => s.id !== deleteId);
  saveData();
  renderTable();
  closeDeleteOverlay();
  showToast('Student removed.', true);
}

function clearAllData() {
  if (students.length === 0) {
    showToast('No records to clear.', true);
    return;
  }

  const confirmed = confirm('Delete all student records from the table? This cannot be undone.');
  if (!confirmed) return;

  students = [];
  saveData();
  renderTable();
  showToast('All table data deleted.', true);
}

let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = toast.querySelector('.toast-icon');
  clearTimeout(toastTimer);

  toastMsg.textContent = msg;
  if (isError) {
    toast.classList.add('error');
    toastIcon.className = 'fas fa-exclamation-circle toast-icon';
  } else {
    toast.classList.remove('error');
    toastIcon.className = 'fas fa-check-circle toast-icon';
  }

  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function clearModalErrors() {
  ['errNIC','errIndex','errBarcode','errName','errSchool','errPart1','errPart2'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['inputNIC','inputIndex','inputBarcode','inputName','inputSchool','inputPart1','inputPart2'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const indicator = document.querySelector('.tab-indicator');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateTabIndicator();
    });
  });

  updateTabIndicator();
}

function updateTabIndicator() {
  const active = document.querySelector('.tab-btn.active');
  const indicator = document.querySelector('.tab-indicator');
  if (!active || !indicator) return;

  const { offsetLeft, offsetWidth } = active;
  indicator.style.left = `${offsetLeft}px`;
  indicator.style.width = `${offsetWidth}px`;
}

function setupFormEnterSubmit() {
  ['inputNIC','inputIndex','inputBarcode','inputName','inputSchool','inputPart1','inputPart2'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') saveStudent();
    });
  });
}

function setupGradeModalEvents() {
  document.getElementById('gradesBtn').addEventListener('click', openGradesModal);
  document.getElementById('gradesClose').addEventListener('click', closeGradesModal);
  document.getElementById('gradesCancelBtn').addEventListener('click', closeGradesModal);
  document.getElementById('applyGradesBtn').addEventListener('click', applyGradeBoundaries);
  document.getElementById('gradesOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('gradesOverlay')) closeGradesModal();
  });
}

function setupSearchAndFilter() {
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderTable();
  });
  document.getElementById('top10Toggle').addEventListener('change', e => {
    showTop10 = e.target.checked;
    renderTable();
  });
}

function setupModalEvents() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
}

function setupDeleteEvents() {
  document.getElementById('deleteClose').addEventListener('click', closeDeleteOverlay);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteOverlay);
  document.getElementById('confirmDeleteBtn').addEventListener('click', deleteStudent);
  document.getElementById('deleteOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteOverlay')) closeDeleteOverlay();
  });
}

function setupInputPreview() {
  document.getElementById('inputPart1').addEventListener('input', updatePreview);
  document.getElementById('inputPart2').addEventListener('input', updatePreview);
}

function setupButtons() {
  document.getElementById('addStudentBtn').addEventListener('click', openAddModal);
  document.getElementById('sortViewBtn').addEventListener('click', toggleSortView);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('xmlExportBtn').addEventListener('click', exportXML);
  document.getElementById('deleteAllBtn').addEventListener('click', clearAllData);
  document.getElementById('saveBtn').addEventListener('click', saveStudent);
}

function initialize() {
  loadData();
  renderTable();
  initTabs();
  setupButtons();
  setupModalEvents();
  setupDeleteEvents();
  setupInputPreview();
  setupFormEnterSubmit();
  setupSearchAndFilter();
  setupGradeModalEvents();

  window.addEventListener('resize', updateTabIndicator);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteOverlay();
      closeGradesModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', initialize);
