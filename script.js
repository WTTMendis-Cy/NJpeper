/* =============================================
   MARKMASTER — Paper Marking System
   script.js
   ============================================= */

// ── Storage Key ──────────────────────────────
const STORAGE_KEY = 'markmaster_students';

// ── State ─────────────────────────────────────
let students    = [];
let editingId   = null;
let deleteId    = null;
let searchQuery = '';

// ── Load from LocalStorage ────────────────────
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  students = raw ? JSON.parse(raw) : [];
}

// ── Save to LocalStorage ──────────────────────
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

// ── Generate unique ID ────────────────────────
function genId() {
  return '_' + Math.random().toString(36).slice(2, 10);
}

// ── Compute Grade ─────────────────────────────
function getGrade(total, max) {
  const pct = (total / max) * 100;
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

// ── Sort Students (highest total first) ───────
function getSorted(list) {
  return [...list].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

// ── Total Colour Class ────────────────────────
function totalClass(total, max) {
  const pct = (total / max) * 100;
  if (pct >= 60) return 'total-high';
  if (pct >= 35) return 'total-mid';
  return 'total-low';
}

// ── Rank Badge HTML ───────────────────────────
function rankBadgeHTML(rank) {
  const cls = rank <= 3 ? `rank-${rank}` : 'rank-n';
  const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
  return `<div class="rank-badge ${cls}">${icon}</div>`;
}

// ── Compute max total (MCQ + Essay max) ───────
function getMaxTotal() {
  // For grade calculation we assume max is 200 (100 MCQ + 100 Essay)
  // You can adjust this if needed
  return 200;
}

// ── Render Table ──────────────────────────────
function renderTable() {
  const tbody      = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const MAX        = getMaxTotal();

  const sorted = getSorted(students);
  const query  = searchQuery.toLowerCase().trim();
  const filtered = query
    ? sorted.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.index.toLowerCase().includes(query))
    : sorted;

  tbody.innerHTML = '';

  if (sorted.length === 0) {
    emptyState.classList.add('show');
    return;
  }
  emptyState.classList.remove('show');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:48px;color:var(--text3);">
          <i class="fas fa-search" style="margin-right:8px;"></i>
          No students match "<strong>${searchQuery}</strong>"
        </td>
      </tr>`;
    return;
  }

  filtered.forEach((student, idx) => {
    // True rank is position in FULL sorted list
    const trueRank = sorted.findIndex(s => s.id === student.id) + 1;
    const grade    = getGrade(student.total, MAX);
    const totCls   = totalClass(student.total, MAX);
    const animDelay = idx * 40;

    const tr = document.createElement('tr');
    tr.style.animationDelay = `${animDelay}ms`;
    tr.innerHTML = `
      <td class="rank-cell">${rankBadgeHTML(trueRank)}</td>
      <td><span class="index-badge">${escHtml(student.index)}</span></td>
      <td><span class="student-name">${escHtml(student.name)}</span></td>
      <td class="mark-cell"><span class="mark-value">${student.mcq}</span></td>
      <td class="mark-cell"><span class="mark-value">${student.essay}</span></td>
      <td class="total-cell"><span class="total-value ${totCls}">${student.total}</span></td>
      <td class="grade-cell">
        <span class="grade-badge grade-${grade}">${grade}</span>
      </td>
      <td class="actions-cell">
        <div class="action-wrap">
          <button class="action-btn action-edit"   title="Edit"   onclick="openEditModal('${student.id}')">
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

// ── Update Header Stats ───────────────────────
function updateStats() {
  const count = students.length;
  const totals = students.map(s => s.total);
  const highest = count ? Math.max(...totals) : null;
  const lowest  = count ? Math.min(...totals) : null;
  const avg     = count ? (totals.reduce((a,b) => a+b,0) / count).toFixed(1) : null;

  document.getElementById('studentCount').textContent = count;
  document.getElementById('statTotal').textContent    = count;
  document.getElementById('statHighest').textContent  = highest ?? '—';
  document.getElementById('statLowest').textContent   = lowest  ?? '—';
  document.getElementById('statAvg').textContent      = avg     ?? '—';
  document.getElementById('topScore').textContent     = highest ?? '—';
}

// ── Escape HTML ───────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal Helpers ─────────────────────────────
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

// ── Open Add Modal ────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent   = 'Add Student';
  document.getElementById('saveBtnText').textContent  = 'Add Student';
  document.getElementById('modalIcon').className      = 'fas fa-user-plus';
  resetForm();
  openModal();
  setTimeout(() => document.getElementById('inputIndex').focus(), 200);
}

// ── Open Edit Modal ───────────────────────────
function openEditModal(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  editingId = id;
  document.getElementById('modalTitle').textContent   = 'Edit Student';
  document.getElementById('saveBtnText').textContent  = 'Save Changes';
  document.getElementById('modalIcon').className      = 'fas fa-user-pen';

  document.getElementById('inputIndex').value = student.index;
  document.getElementById('inputName').value  = student.name;
  document.getElementById('inputMCQ').value   = student.mcq;
  document.getElementById('inputEssay').value = student.essay;

  updatePreview();
  openModal();
  setTimeout(() => document.getElementById('inputName').focus(), 200);
}

// ── Open Delete Confirm ───────────────────────
function openDeleteModal(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;
  deleteId = id;
  document.getElementById('deleteStudentName').textContent = student.name;
  openDeleteOverlay();
}

// ── Reset Form ────────────────────────────────
function resetForm() {
  ['inputIndex','inputName','inputMCQ','inputEssay'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  document.getElementById('previewTotal').textContent = '—';
  document.getElementById('previewTotal').style.color = 'var(--cyan)';
  document.getElementById('previewGrade').textContent = '';
  document.getElementById('previewGrade').className   = 'preview-grade';
}

// ── Clear Errors ──────────────────────────────
function clearModalErrors() {
  ['errIndex','errName','errMCQ','errEssay'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['inputIndex','inputName','inputMCQ','inputEssay'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

// ── Live Preview ──────────────────────────────
function updatePreview() {
  const mcq   = parseFloat(document.getElementById('inputMCQ').value)   || 0;
  const essay = parseFloat(document.getElementById('inputEssay').value) || 0;
  const total = mcq + essay;
  const MAX   = getMaxTotal();

  const previewEl = document.getElementById('previewTotal');
  const gradeEl   = document.getElementById('previewGrade');

  if (document.getElementById('inputMCQ').value === '' &&
      document.getElementById('inputEssay').value === '') {
    previewEl.textContent = '—';
    previewEl.style.color = 'var(--cyan)';
    gradeEl.textContent   = '';
    gradeEl.className     = 'preview-grade';
    return;
  }

  previewEl.textContent = total;
  const grade = getGrade(total, MAX);

  const colorMap = { A:'var(--green)', B:'var(--blue)', C:'var(--gold)', D:'var(--red)', F:'var(--text3)' };
  previewEl.style.color = colorMap[grade];

  gradeEl.textContent = grade;
  gradeEl.className   = `preview-grade grade-badge grade-${grade}`;
}

// ── Validate ──────────────────────────────────
function validateForm() {
  clearModalErrors();
  const index = document.getElementById('inputIndex').value.trim();
  const name  = document.getElementById('inputName').value.trim();
  const mcqV  = document.getElementById('inputMCQ').value;
  const essayV= document.getElementById('inputEssay').value;
  const mcq   = parseFloat(mcqV);
  const essay = parseFloat(essayV);
  let valid   = true;

  function setErr(inputId, errId, msg) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errId).textContent = msg;
    valid = false;
  }

  if (!index) setErr('inputIndex','errIndex','Index number required.');
  else if (students.some(s => s.index === index && s.id !== editingId))
    setErr('inputIndex','errIndex','This index already exists.');

  if (!name) setErr('inputName','errName','Student name required.');

  if (mcqV === '')       setErr('inputMCQ','errMCQ','MCQ marks required.');
  else if (isNaN(mcq) || mcq < 0) setErr('inputMCQ','errMCQ','Enter a valid number ≥ 0.');

  if (essayV === '')     setErr('inputEssay','errEssay','Essay marks required.');
  else if (isNaN(essay) || essay < 0) setErr('inputEssay','errEssay','Enter a valid number ≥ 0.');

  return valid;
}

// ── Save Student ──────────────────────────────
function saveStudent() {
  if (!validateForm()) return;

  const index = document.getElementById('inputIndex').value.trim();
  const name  = document.getElementById('inputName').value.trim();
  const mcq   = parseFloat(document.getElementById('inputMCQ').value);
  const essay = parseFloat(document.getElementById('inputEssay').value);
  const total = mcq + essay;

  if (editingId) {
    const idx = students.findIndex(s => s.id === editingId);
    if (idx !== -1) {
      students[idx] = { ...students[idx], index, name, mcq, essay, total };
    }
    showToast('Student updated successfully!');
  } else {
    students.push({ id: genId(), index, name, mcq, essay, total });
    showToast('Student added successfully!');
  }

  saveData();
  renderTable();
  closeModal();
}

// ── Delete Student ────────────────────────────
function deleteStudent() {
  if (!deleteId) return;
  students = students.filter(s => s.id !== deleteId);
  saveData();
  renderTable();
  closeDeleteOverlay();
  showToast('Student removed.', true);
}

// ── Toast ─────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon= toast.querySelector('.toast-icon');
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

// ── Export CSV ────────────────────────────────
function exportCSV() {
  if (students.length === 0) {
    showToast('No students to export!', true); return;
  }

  const sorted = getSorted(students);
  const MAX    = getMaxTotal();
  const header = ['Rank','Index No.','Name','MCQ Marks','Essay Marks','Total Marks','Grade'];
  const rows   = sorted.map((s, i) => [
    i + 1, s.index, s.name, s.mcq, s.essay, s.total, getGrade(s.total, MAX)
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `marks_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
}

// ── Event Listeners ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderTable();

  // Add button
  document.getElementById('addStudentBtn').addEventListener('click', openAddModal);

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Delete modal
  document.getElementById('deleteClose').addEventListener('click', closeDeleteOverlay);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteOverlay);
  document.getElementById('confirmDeleteBtn').addEventListener('click', deleteStudent);
  document.getElementById('deleteOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteOverlay')) closeDeleteOverlay();
  });

  // Save
  document.getElementById('saveBtn').addEventListener('click', saveStudent);

  // Live preview
  document.getElementById('inputMCQ').addEventListener('input', updatePreview);
  document.getElementById('inputEssay').addEventListener('input', updatePreview);

  // Enter key to save
  ['inputIndex','inputName','inputMCQ','inputEssay'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') saveStudent();
    });
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderTable();
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // Keyboard shortcut: Escape to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteOverlay();
    }
  });
});