/* =============================================
   MARKMASTER — Paper Marking System (Multi-Batch)
   script.js
   ============================================= */

const STORAGE_KEY = 'markmaster_data';

// ===== STATE MANAGEMENT =====

let appState = {
  batches: [],
  activeBatchId: null
};

let editingId = null;
let deleteId = null;
let deleteBatchId = null;
let editingBatchId = null;
let searchQuery = '';
let showTop10 = false;
let sortByRank = false;

// ===== SPLASH SCREEN INITIALIZATION =====

function initSplashScreen() {
  const splashScreen = document.getElementById('splashScreen');
  const loadingText = document.getElementById('splashLoadingText');
  const loadingBar = document.getElementById('loadingBarFill');

  // Update loading text at different intervals
  const timestamps = [
    { time: 800, text: 'Loading data...' },
    { time: 1800, text: 'Ready!' },
    { time: 2800, text: null } // Hide splash
  ];

  timestamps.forEach(({ time, text }) => {
    setTimeout(() => {
      if (text === null) {
        // Fade out splash screen
        splashScreen.classList.add('fade-out');
        setTimeout(() => {
          splashScreen.style.display = 'none';
        }, 500);
      } else {
        // Update loading text
        loadingText.textContent = text;
      }
    }, time);
  });
}

// ===== DATA ACCESS HELPERS =====

function getCurrentBatch() {
  return appState.batches.find(b => b.id === appState.activeBatchId);
}

function getCurrentBatchStudents() {
  const batch = getCurrentBatch();
  return batch ? batch.students : [];
}

function getCurrentGradeBoundaries() {
  const batch = getCurrentBatch();
  return batch ? batch.gradeThresholds : { A: 150, B: 120, C: 100, D: 70 };
}

function getGrade(total) {
  const boundaries = getCurrentGradeBoundaries();
  if (total >= boundaries.A) return 'A';
  if (total >= boundaries.B) return 'B';
  if (total >= boundaries.C) return 'C';
  if (total >= boundaries.D) return 'D';
  return 'F';
}

// ===== STORAGE =====

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      appState = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse stored data:', e);
      appState = { batches: [], activeBatchId: null };
    }
  }

  // If no batches exist, create a default one
  if (appState.batches.length === 0) {
    createDefaultBatch();
  }

  // Set active batch if not set
  if (!appState.activeBatchId || !getCurrentBatch()) {
    appState.activeBatchId = appState.batches[0]?.id || null;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function genId() {
  return '_' + Math.random().toString(36).slice(2, 10);
}

function createDefaultBatch() {
  const defaultBatch = {
    id: genId(),
    name: 'Default Batch',
    createdAt: new Date().toISOString(),
    students: [],
    gradeThresholds: { A: 150, B: 120, C: 100, D: 70 }
  };
  appState.batches.push(defaultBatch);
  appState.activeBatchId = defaultBatch.id;
}

// ===== BATCH OPERATIONS =====

function createBatch(batchName) {
  const newBatch = {
    id: genId(),
    name: batchName,
    createdAt: new Date().toISOString(),
    students: [],
    gradeThresholds: { A: 150, B: 120, C: 100, D: 70 }
  };
  appState.batches.push(newBatch);
  appState.activeBatchId = newBatch.id;
  saveData();
  return newBatch;
}

function renameBatch(batchId, newName) {
  const batch = appState.batches.find(b => b.id === batchId);
  if (batch) {
    batch.name = newName;
    saveData();
  }
}

function deleteBatch(batchId) {
  const index = appState.batches.findIndex(b => b.id === batchId);
  if (index !== -1) {
    appState.batches.splice(index, 1);

    // If we deleted the active batch, switch to another
    if (appState.activeBatchId === batchId) {
      if (appState.batches.length > 0) {
        appState.activeBatchId = appState.batches[0].id;
      } else {
        // Create a new default batch if none left
        createDefaultBatch();
      }
    }

    saveData();
  }
}

function switchBatch(batchId) {
  if (appState.batches.find(b => b.id === batchId)) {
    appState.activeBatchId = batchId;
    saveData();
    resetFilters();
    renderUI();
  }
}

// ===== STUDENT OPERATIONS =====

function getSortedStudents(students) {
  return [...students].sort((a, b) => {
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
  let students = getCurrentBatchStudents();
  let sorted = getSortedStudents(students);
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

function addStudent(nic, index, barcode, name, school, part1, part2) {
  const batch = getCurrentBatch();
  if (!batch) return;

  const total = part1 + part2;
  const student = {
    id: genId(),
    nic,
    index,
    barcode,
    name,
    school,
    part1,
    part2,
    total
  };

  batch.students.push(student);
  saveData();
}

function updateStudent(studentId, nic, index, barcode, name, school, part1, part2) {
  const batch = getCurrentBatch();
  if (!batch) return;

  const student = batch.students.find(s => s.id === studentId);
  if (student) {
    student.nic = nic;
    student.index = index;
    student.barcode = barcode;
    student.name = name;
    student.school = school;
    student.part1 = part1;
    student.part2 = part2;
    student.total = part1 + part2;
    saveData();
  }
}

function deleteStudentFromBatch(studentId) {
  const batch = getCurrentBatch();
  if (!batch) return;

  batch.students = batch.students.filter(s => s.id !== studentId);
  saveData();
}

function clearAllStudents() {
  const batch = getCurrentBatch();
  if (!batch) return;

  batch.students = [];
  saveData();
}

function updateGradeBoundaries(a, b, c, d) {
  const batch = getCurrentBatch();
  if (!batch) return;

  batch.gradeThresholds = { A: a, B: b, C: c, D: d };
  saveData();
}

function resetFilters() {
  searchQuery = '';
  showTop10 = false;
  sortByRank = false;
  document.getElementById('searchInput').value = '';
  document.getElementById('top10Toggle').checked = false;
}

// ===== UI RENDERING =====

function renderBatchesList() {
  const list = document.getElementById('batchesList');
  list.innerHTML = '';

  appState.batches.forEach(batch => {
    const item = document.createElement('div');
    item.className = `batch-item ${batch.id === appState.activeBatchId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="batch-item-content" onclick="switchBatchAndRender('${batch.id}')">
        <div class="batch-item-icon"><i class="fas fa-folder"></i></div>
        <div class="batch-item-name">${escHtml(batch.name)}</div>
        <div class="batch-item-badge">${batch.students.length}</div>
      </div>
      <div class="batch-item-actions">
        <button class="batch-item-btn rename" onclick="openRenameBatchModal('${batch.id}')" title="Rename">
          <i class="fas fa-pen-to-square"></i>
        </button>
        <button class="batch-item-btn delete" onclick="openDeleteBatchModal('${batch.id}')" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    list.appendChild(item);
  });
}

function updateBatchContext() {
  const batch = getCurrentBatch();
  const contextEl = document.getElementById('batchContext');
  const batchDisplayEl = document.getElementById('currentBatchDisplay');
  const batchNameEl = document.getElementById('currentBatchName');
  
  if (batch) {
    contextEl.textContent = `${batch.name} (${batch.students.length} students)`;
    batchNameEl.textContent = batch.name;
    
    // Trigger fade-in animation
    batchDisplayEl.classList.remove('fade-in');
    void batchDisplayEl.offsetWidth; // Trigger reflow
    batchDisplayEl.classList.add('fade-in');
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const students = getCurrentBatchStudents();
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
          No students match "<strong>${escHtml(searchQuery)}</strong>"
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
  const students = getCurrentBatchStudents();
  const count = students.length;
  const totals = students.map(s => s.total);
  const highest = count ? Math.max(...totals) : null;
  const lowest = count ? Math.min(...totals) : null;
  const avg = count ? (totals.reduce((a, b) => a + b, 0) / count).toFixed(1) : null;

  document.getElementById('studentCount').textContent = count;
  document.getElementById('statTotal').textContent = count;
  document.getElementById('statHighest').textContent = highest ?? '—';
  document.getElementById('statLowest').textContent = lowest ?? '—';
  document.getElementById('statAvg').textContent = avg ?? '—';
  document.getElementById('topScore').textContent = highest ?? '—';
}

function totalClass(total) {
  const boundaries = getCurrentGradeBoundaries();
  if (total >= boundaries.B) return 'total-high';
  if (total >= boundaries.D) return 'total-mid';
  return 'total-low';
}

function renderUI() {
  renderBatchesList();
  updateBatchContext();
  renderTable();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== MODAL FUNCTIONS =====

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  clearModalErrors();
  resetForm();
  editingId = null;
}

function openBatchModal(isCreate = true, batchId = null) {
  if (!isCreate && batchId) {
    editingBatchId = batchId;
    const batch = appState.batches.find(b => b.id === batchId);
    document.getElementById('batchModalTitle').textContent = 'Rename Batch';
    document.getElementById('saveBatchBtnText').textContent = 'Save Changes';
    document.getElementById('batchModalIcon').className = 'fas fa-folder-open';
    document.getElementById('batchNameInput').value = batch ? batch.name : '';
  } else {
    editingBatchId = null;
    document.getElementById('batchModalTitle').textContent = 'Create New Batch';
    document.getElementById('saveBatchBtnText').textContent = 'Create Batch';
    document.getElementById('batchModalIcon').className = 'fas fa-folder-plus';
    document.getElementById('batchNameInput').value = '';
  }

  document.getElementById('errBatchName').textContent = '';
  document.getElementById('batchModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('batchNameInput').focus(), 200);
}

function closeBatchModal() {
  document.getElementById('batchModalOverlay').classList.remove('open');
  editingBatchId = null;
}

function openDeleteBatchModal(batchId) {
  const batch = appState.batches.find(b => b.id === batchId);
  if (!batch) return;

  deleteBatchId = batchId;
  document.getElementById('deleteBatchName').textContent = batch.name;
  document.getElementById('deleteBatchStudentCount').textContent = batch.students.length;
  document.getElementById('deleteBatchOverlay').classList.add('open');
}

function closeDeleteBatchModal() {
  document.getElementById('deleteBatchOverlay').classList.remove('open');
  deleteBatchId = null;
}

function openDeleteOverlay() {
  document.getElementById('deleteOverlay').classList.add('open');
}

function closeDeleteOverlay() {
  document.getElementById('deleteOverlay').classList.remove('open');
  deleteId = null;
}

function openGradesModal() {
  const boundaries = getCurrentGradeBoundaries();
  document.getElementById('gradeAInput').value = boundaries.A;
  document.getElementById('gradeBInput').value = boundaries.B;
  document.getElementById('gradeCInput').value = boundaries.C;
  document.getElementById('gradeDInput').value = boundaries.D;
  updateBoundariesDisplay();
  document.getElementById('gradesOverlay').classList.add('open');
}

function closeGradesModal() {
  document.getElementById('gradesOverlay').classList.remove('open');
}

function updateBoundariesDisplay() {
  const boundaries = getCurrentGradeBoundaries();
  const display = document.getElementById('boundariesDisplay');
  display.innerHTML = `
    <div class="boundary-item"><strong>A:</strong> ${boundaries.A}+</div>
    <div class="boundary-item"><strong>B:</strong> ${boundaries.B}+</div>
    <div class="boundary-item"><strong>C:</strong> ${boundaries.C}+</div>
    <div class="boundary-item"><strong>D:</strong> ${boundaries.D}+</div>
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

  updateGradeBoundaries(aValue, bValue, cValue, dValue);
  updateBoundariesDisplay();
  renderTable();
  showToast('Grade boundaries updated.');
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
  const student = getCurrentBatchStudents().find(s => s.id === id);
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
  const student = getCurrentBatchStudents().find(s => s.id === id);
  if (!student) return;

  deleteId = id;
  document.getElementById('deleteStudentName').textContent = student.name;
  openDeleteOverlay();
}

function resetForm() {
  ['inputNIC', 'inputIndex', 'inputBarcode', 'inputName', 'inputSchool', 'inputPart1', 'inputPart2'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  clearModalErrors();
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

  const students = getCurrentBatchStudents();
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

function validateBatchForm() {
  const errEl = document.getElementById('errBatchName');
  const nameInput = document.getElementById('batchNameInput');
  const name = nameInput.value.trim();

  errEl.textContent = '';
  nameInput.classList.remove('error');

  if (!name) {
    nameInput.classList.add('error');
    errEl.textContent = 'Batch name is required.';
    return false;
  }

  return true;
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
  const colorMap = { A: 'var(--green)', B: 'var(--blue)', C: 'var(--gold)', D: 'var(--red)', F: 'var(--text3)' };
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

  if (editingId !== null) {
    updateStudent(editingId, nic, index, barcode, name, school, part1, part2);
    showToast('Student updated successfully!');
  } else {
    addStudent(nic, index, barcode, name, school, part1, part2);
    showToast('Student added successfully!');
  }

  renderTable();
  closeModal();
}

function saveBatch() {
  if (!validateBatchForm()) return;

  const name = document.getElementById('batchNameInput').value.trim();

  if (editingBatchId) {
    renameBatch(editingBatchId, name);
    showToast('Batch renamed successfully!');
  } else {
    createBatch(name);
    showToast('Batch created successfully!');
  }

  renderUI();
  closeBatchModal();
}

function deleteStudent() {
  if (deleteId === null) return;
  deleteStudentFromBatch(deleteId);
  renderTable();
  closeDeleteOverlay();
  showToast('Student removed.', true);
}

function deleteBatchConfirmed() {
  if (deleteBatchId === null) return;
  deleteBatch(deleteBatchId);
  renderUI();
  closeDeleteBatchModal();
  showToast('Batch deleted.', true);
}

function clearAllData() {
  const batch = getCurrentBatch();
  if (!batch || batch.students.length === 0) {
    showToast('No records to clear.', true);
    return;
  }

  const confirmed = confirm('Are you sure you want to permanently delete ALL student data from this batch?');
  if (!confirmed) return;

  clearAllStudents();
  renderTable();
  showToast('All table data deleted.', true);
}

function toggleSortView() {
  sortByRank = !sortByRank;
  const sortButton = document.getElementById('sortViewBtn');
  sortButton.innerHTML = sortByRank
    ? '<i class="fas fa-sort-numeric-down"></i> Sort by Index'
    : '<i class="fas fa-sort"></i> Sort by Rank';
  renderTable();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('markmaster_sidebar_collapsed', sidebar.classList.contains('collapsed'));
}

function switchBatchAndRender(batchId) {
  switchBatch(batchId);
  renderUI();
}

function openRenameBatchModal(batchId) {
  openBatchModal(false, batchId);
}

// ===== EXPORT FUNCTIONS =====

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getXmlExportString() {
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

  return `<?xml version="1.0" encoding="UTF-8"?>\n<students>${rows}\n</students>`;
}

function exportCSV() {
  const students = getCurrentBatchStudents();
  if (students.length === 0) {
    showToast('No students to export!', true);
    return;
  }

  const visible = getVisibleStudents();
  const batch = getCurrentBatch();

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
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const batchName = batch ? batch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'batch';
  a.download = `${batchName}_${sortByRank ? 'rank' : 'index'}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
}

function exportAllBatches() {
  if (appState.batches.length === 0) {
    showToast('No batches to export!', true);
    return;
  }

  // Create combined CSV with batch information
  let fullCsv = '';

  appState.batches.forEach((batch, batchIndex) => {
    if (batchIndex > 0) fullCsv += '\n\n';

    fullCsv += `BATCH: ${batch.name}\nCreated: ${batch.createdAt}\nStudents: ${batch.students.length}\n\n`;

    const header = ['NIC No', 'Index No.', 'Barcode No', 'Name', 'School', 'Part 1 Marks', 'Part 2 Marks', 'Total'];
    const rows = batch.students.map(student => [
      student.nic,
      student.index,
      student.barcode,
      student.name,
      student.school,
      student.part1,
      student.part2,
      student.total
    ]);

    const batchCsv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    fullCsv += batchCsv;
  });

  const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `markmaster_all_batches_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('All batches exported!');
}

function saveAsJSON() {
  const json = JSON.stringify(appState, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `markmaster_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup saved as JSON!');
}

function loadFromJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const loaded = JSON.parse(event.target.result);
        if (loaded.batches && Array.isArray(loaded.batches)) {
          appState = loaded;
          saveData();
          renderUI();
          showToast('Data loaded successfully!');
        } else {
          showToast('Invalid backup file format!', true);
        }
      } catch (err) {
        showToast('Failed to parse backup file!', true);
        console.error(err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ===== TOAST NOTIFICATIONS =====

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
  ['errNIC', 'errIndex', 'errBarcode', 'errName', 'errSchool', 'errPart1', 'errPart2'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['inputNIC', 'inputIndex', 'inputBarcode', 'inputName', 'inputSchool', 'inputPart1', 'inputPart2'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

// ===== TAB MANAGEMENT =====

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

// ===== EVENT SETUP =====

function setupFormEnterSubmit() {
  ['inputNIC', 'inputIndex', 'inputBarcode', 'inputName', 'inputSchool', 'inputPart1', 'inputPart2'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') saveStudent();
    });
  });

  document.getElementById('batchNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBatch();
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

function setupBatchModalEvents() {
  document.getElementById('newBatchBtn').addEventListener('click', () => openBatchModal(true));
  document.getElementById('batchModalClose').addEventListener('click', closeBatchModal);
  document.getElementById('batchCancelBtn').addEventListener('click', closeBatchModal);
  document.getElementById('saveBatchBtn').addEventListener('click', saveBatch);
  document.getElementById('batchModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('batchModalOverlay')) closeBatchModal();
  });

  document.getElementById('deleteBatchClose').addEventListener('click', closeDeleteBatchModal);
  document.getElementById('deleteBatchCancelBtn').addEventListener('click', closeDeleteBatchModal);
  document.getElementById('confirmDeleteBatchBtn').addEventListener('click', deleteBatchConfirmed);
  document.getElementById('deleteBatchOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteBatchOverlay')) closeDeleteBatchModal();
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
  document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
  document.getElementById('addStudentBtn').addEventListener('click', openAddModal);
  document.getElementById('sortViewBtn').addEventListener('click', toggleSortView);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('deleteAllBtn').addEventListener('click', clearAllData);
  document.getElementById('saveBtn').addEventListener('click', saveStudent);
}

function setupSidebarState() {
  const collapsed = localStorage.getItem('markmaster_sidebar_collapsed') === 'true';
  if (collapsed) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
}

function initialize() {
  initSplashScreen();
  loadData();
  setupSidebarState();
  renderUI();
  initTabs();
  setupButtons();
  setupModalEvents();
  setupBatchModalEvents();
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
      closeBatchModal();
      closeDeleteBatchModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', initialize);
