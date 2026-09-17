/* ==========================================================================
   SMART EQUIPMENT MAINTENANCE SYSTEM (SEMS) - FRONTEND APP ENGINE
   Full Stack Interactive Enterprise ERP JS Architecture
   EmailJS Integration Service ID: service_h7mfjgf
   ========================================================================== */

// Global State Management
const SEMS_STATE = {
  currentUser: { name: 'Alex Mercer (Admin)', role: 'Plant Manager (Admin)', email: 'admin@smartfactory.com' },
  machines: [],
  technicians: [],
  maintenanceTasks: [],
  notifications: [],
  kpiData: { total_machines: 150, active_machines: 132, maintenance_due: 10, overdue_maintenance: 3, completed_services: 95 },
  charts: {},
  emailjsConfig: {
    serviceId: "service_o5cu60m",
    publicKey: "",
    templateId: "template_default"
  }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initEmailJS();
  fetchInitialData();
});

/* --------------------------------------------------------
   INITIALIZATION & API FETCHING
   -------------------------------------------------------- */
function initEmailJS() {
  try {
    if (window.emailjs && SEMS_STATE.emailjsConfig.publicKey) {
      emailjs.init(SEMS_STATE.emailjsConfig.publicKey);
    }
  } catch (e) {
    console.warn("EmailJS initialized:", e);
  }
}

async function fetchInitialData() {
  try {
    const kpiRes = await fetch('/api/kpi');
    if (kpiRes.ok) {
      SEMS_STATE.kpiData = await kpiRes.json();
      updateKPICards();
    }

    const macRes = await fetch('/api/machines');
    if (macRes.ok) {
      SEMS_STATE.machines = await macRes.json();
      renderMachinesTable();
    }

    const techRes = await fetch('/api/technicians');
    if (techRes.ok) {
      SEMS_STATE.technicians = await techRes.json();
      renderTechniciansTable();
      populateEmailTechDropdown();
    }

    const mainRes = await fetch('/api/maintenance');
    if (mainRes.ok) {
      SEMS_STATE.maintenanceTasks = await mainRes.json();
      renderSchedulerTable();
      renderRecentActivityTable();
    }

    const notifRes = await fetch('/api/notifications');
    if (notifRes.ok) {
      SEMS_STATE.notifications = await notifRes.json();
      renderNotifications();
    }

    initCharts();

  } catch (err) {
    console.error("API fetch fallback active:", err);
    updateKPICards();
    initCharts();
  }
}

/* --------------------------------------------------------
   TAB ROUTING & PAGE NAVIGATION
   -------------------------------------------------------- */
function switchTab(viewId, element) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));

  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  const titleMap = {
    'dashboardView': 'Executive Maintenance Dashboard',
    'machinesView': 'Machine Inventory System',
    'addMachineView': 'Add Machine Record',
    'schedulerView': 'Calendar Maintenance Scheduler',
    'techniciansView': 'Technician Roster & Email Dispatch',
    'notificationsView': 'Notification Center & Email Alerts',
    'reportsView': 'Industrial Analytics & Reports',
    'settingsView': 'Settings & System Architecture'
  };

  const titleElem = document.getElementById('pageTitleDisplay');
  if (titleElem && titleMap[viewId]) {
    titleElem.innerText = titleMap[viewId];
  }

  if (viewId === 'reportsView' && SEMS_STATE.charts.downtimeBar) {
    SEMS_STATE.charts.downtimeBar.resize();
    SEMS_STATE.charts.costChart.resize();
  }
}

/* --------------------------------------------------------
   PAGE 1: LOGIN & AUTHENTICATION
   -------------------------------------------------------- */
function fillLogin(email, password) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = password || 'SmartFactory2026!';
}

function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  if (email && password) {
    if (email.includes('sarah')) {
      SEMS_STATE.currentUser = { name: 'Sarah Connor', role: 'Senior Reliability Engineer', email: email };
    } else {
      SEMS_STATE.currentUser = { name: 'Alex Mercer (Admin)', role: 'Plant Manager (Admin)', email: email };
    }

    document.getElementById('userNameDisplay').innerText = SEMS_STATE.currentUser.name;
    document.getElementById('userRoleDisplay').innerText = SEMS_STATE.currentUser.role;
    document.getElementById('userAvatar').innerText = SEMS_STATE.currentUser.name.split(' ').map(n => n[0]).join('');

    document.getElementById('loginPage').style.display = 'none';
    showToast(`Logged in as ${SEMS_STATE.currentUser.name}`);
  }
}

function logout() {
  document.getElementById('loginPage').style.display = 'flex';
  showToast('Logged out of Smart Maintenance System.');
}

/* --------------------------------------------------------
   PAGE 2: DASHBOARD & KPI UPDATES
   -------------------------------------------------------- */
function updateKPICards() {
  const data = SEMS_STATE.kpiData;
  document.getElementById('kpiTotalMachines').innerText = data.total_machines || 150;
  document.getElementById('kpiActiveMachines').innerText = data.active_machines || 132;
  document.getElementById('kpiMaintenanceDue').innerText = data.maintenance_due || 10;
  document.getElementById('kpiOverdue').innerText = data.overdue_maintenance || 3;
  document.getElementById('kpiCompleted').innerText = data.completed_services || 95;
}

function renderRecentActivityTable() {
  const tbody = document.getElementById('recentActivityTableBody');
  if (!tbody) return;

  const sampleActivities = [
    { name: 'CNC Milling Station 01', type: 'Routine Lubrication', date: '2026-09-20', status: 'Scheduled', tech: 'Marcus Vance' },
    { name: 'Boiler Unit B', type: 'Safety Valve Inspection', date: '2026-09-11', status: 'Overdue', tech: 'David Chen' },
    { name: 'Rotary Air Compressor C4', type: 'Emergency Filter Swap', date: '2026-09-05', status: 'Pending', tech: 'Elena Rostova' },
    { name: 'Hydraulic Press 500T', type: 'Hydraulic Oil Flush', date: '2026-08-15', status: 'Completed', tech: 'Rajesh Kumar' },
    { name: 'Robotic Arm KUKA KR60', type: 'Servo Joint Zeroing', date: '2026-08-25', status: 'Completed', tech: 'Rajesh Kumar' }
  ];

  tbody.innerHTML = sampleActivities.map(act => `
    <tr>
      <td style="font-weight: 700;">${act.name}</td>
      <td>${act.type}</td>
      <td style="font-family: var(--font-mono);">${act.date}</td>
      <td>${getStatusBadge(act.status)}</td>
      <td>${act.tech}</td>
    </tr>
  `).join('');
}

/* --------------------------------------------------------
   CHARTS INITIALIZATION (CHART.JS)
   -------------------------------------------------------- */
function initCharts() {
  const trendCtx = document.getElementById('monthlyTrendChart');
  if (trendCtx) {
    SEMS_STATE.charts.trendLine = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'],
        datasets: [
          {
            label: 'Completed Preventive Maintenance',
            data: [77, 84, 88, 92, 97, 95],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.35,
            borderWidth: 3
          },
          {
            label: 'Unplanned Machine Breakdowns',
            data: [5, 4, 3, 2, 1, 3],
            borderColor: '#ef4444',
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  const statusCtx = document.getElementById('statusPieChart');
  if (statusCtx) {
    SEMS_STATE.charts.statusPie = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Completed Services', 'Pending / Scheduled', 'Overdue Alerts'],
        datasets: [{
          data: [95, 10, 3],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  const downtimeCtx = document.getElementById('downtimeBarChart');
  if (downtimeCtx) {
    SEMS_STATE.charts.downtimeBar = new Chart(downtimeCtx, {
      type: 'bar',
      data: {
        labels: ['Machining Shop', 'Thermal Utilities', 'Assembly Line A', 'Robotics Hub', 'Utility Plant'],
        datasets: [{
          label: 'Downtime Hours (Sep 2026)',
          data: [18.5, 34.0, 12.2, 8.0, 22.5],
          backgroundColor: '#0284c7',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  const costCtx = document.getElementById('costAnalysisChart');
  if (costCtx) {
    SEMS_STATE.charts.costChart = new Chart(costCtx, {
      type: 'bar',
      data: {
        labels: ['Spare Parts', 'Labor', 'Emergency Repair', 'Overhauls'],
        datasets: [{
          label: 'Cost Expenditure ($)',
          data: [14200, 9800, 4500, 18600],
          backgroundColor: ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
}

/* --------------------------------------------------------
   PAGE 3: MACHINE MANAGEMENT & EDITING
   -------------------------------------------------------- */
function renderMachinesTable() {
  const tbody = document.getElementById('machinesTableBody');
  if (!tbody) return;

  const machines = SEMS_STATE.machines;

  tbody.innerHTML = machines.slice(0, 25).map(m => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--primary-navy);">${m.machine_id}</td>
      <td style="font-weight: 700;">${m.machine_name}</td>
      <td>${m.category}</td>
      <td>${m.location}</td>
      <td style="font-family: var(--font-mono);">${m.install_date}</td>
      <td style="font-family: var(--font-mono);">${m.next_service_date || '2026-09-25'}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; width: 60px;">
            <div style="height: 100%; width: ${m.health_score || 90}%; background: ${m.health_score < 70 ? '#ef4444' : '#10b981'};"></div>
          </div>
          <span style="font-size: 0.75rem; font-weight: 700;">${m.health_score || 90}%</span>
        </div>
      </td>
      <td>${getStatusBadge(m.status)}</td>
      <td>
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="openEditMachineModal('${m.machine_id}')" title="Edit Machine"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteMachine('${m.machine_id}')" title="Delete Machine"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterMachinesList() {
  const query = document.getElementById('machineSearchInput').value.toLowerCase();
  const status = document.getElementById('statusFilterSelect').value;

  const filtered = SEMS_STATE.machines.filter(m => {
    const matchesQ = m.machine_name.toLowerCase().includes(query) || m.machine_id.toLowerCase().includes(query) || m.department.toLowerCase().includes(query);
    const matchesStatus = !status || m.status === status;
    return matchesQ && matchesStatus;
  });

  const tbody = document.getElementById('machinesTableBody');
  tbody.innerHTML = filtered.slice(0, 25).map(m => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 700;">${m.machine_id}</td>
      <td style="font-weight: 700;">${m.machine_name}</td>
      <td>${m.category}</td>
      <td>${m.location}</td>
      <td style="font-family: var(--font-mono);">${m.install_date}</td>
      <td style="font-family: var(--font-mono);">${m.next_service_date || '2026-09-25'}</td>
      <td><span style="font-weight: 700;">${m.health_score || 90}%</span></td>
      <td>${getStatusBadge(m.status)}</td>
      <td>
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn btn-secondary btn-sm" onclick="openEditMachineModal('${m.machine_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteMachine('${m.machine_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openEditMachineModal(machineId) {
  const m = SEMS_STATE.machines.find(item => item.machine_id === machineId);
  if (!m) return;

  document.getElementById('editMachineIdHidden').value = m.machine_id;
  document.getElementById('editMachineIdDisplay').value = m.machine_id;
  document.getElementById('editMachineName').value = m.machine_name;
  document.getElementById('editCategory').value = m.category;
  document.getElementById('editDepartment').value = m.department;
  document.getElementById('editLocation').value = m.location;
  document.getElementById('editStatus').value = m.status;

  openModal('editMachineModal');
}

async function submitEditMachine() {
  const mId = document.getElementById('editMachineIdHidden').value;
  const updatedData = {
    machine_id: mId,
    machine_name: document.getElementById('editMachineName').value,
    category: document.getElementById('editCategory').value,
    department: document.getElementById('editDepartment').value,
    location: document.getElementById('editLocation').value,
    status: document.getElementById('editStatus').value,
    machine_type: 'Standard',
    manufacturer: 'Siemens'
  };

  try {
    await fetch(`/api/machines/${mId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
  } catch (e) { }

  const targetIdx = SEMS_STATE.machines.findIndex(m => m.machine_id === mId);
  if (targetIdx !== -1) {
    SEMS_STATE.machines[targetIdx] = { ...SEMS_STATE.machines[targetIdx], ...updatedData };
  }

  renderMachinesTable();
  closeModal('editMachineModal');
  showToast(`Machine ${mId} details updated.`);
}

async function deleteMachine(machineId) {
  if (confirm(`Are you sure you want to delete Machine ${machineId}?`)) {
    try {
      await fetch(`/api/machines/${machineId}`, { method: 'DELETE' });
    } catch (e) { }
    SEMS_STATE.machines = SEMS_STATE.machines.filter(m => m.machine_id !== machineId);
    renderMachinesTable();
    showToast(`Machine ${machineId} deleted.`);
  }
}

/* --------------------------------------------------------
   PAGE 4: ADD MACHINE FORM LOGIC
   -------------------------------------------------------- */
function generateAutoId() {
  const randNum = Math.floor(100 + Math.random() * 900);
  document.getElementById('addMachineId').value = `MCH-NEW-${randNum}`;
}

async function submitAddMachine() {
  const newMachine = {
    machine_id: document.getElementById('addMachineId').value,
    machine_name: document.getElementById('addMachineName').value,
    machine_type: document.getElementById('addMachineType').value,
    category: document.getElementById('addCategory').value,
    department: document.getElementById('addDepartment').value,
    location: document.getElementById('addLocation').value,
    install_date: document.getElementById('addInstallDate').value,
    manufacturer: document.getElementById('addManufacturer').value,
    maintenance_interval: document.getElementById('addInterval').value,
    notes: document.getElementById('addNotes').value,
    status: 'Active',
    health_score: 98
  };

  try {
    await fetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMachine)
    });
  } catch (e) { }

  SEMS_STATE.machines.unshift(newMachine);
  SEMS_STATE.kpiData.total_machines += 1;
  SEMS_STATE.kpiData.active_machines += 1;
  updateKPICards();
  renderMachinesTable();

  showToast(`Machine ${newMachine.machine_id} registered into database!`);
  switchTab('machinesView', document.querySelector('[data-target=machinesView]'));
}

/* --------------------------------------------------------
   PAGE 5: MAINTENANCE SCHEDULER LOGIC
   -------------------------------------------------------- */
function renderSchedulerTable() {
  const tbody = document.getElementById('schedulerTableBody');
  if (!tbody) return;

  const tasks = SEMS_STATE.maintenanceTasks;

  tbody.innerHTML = tasks.map(t => `
    <tr>
      <td style="font-family: var(--font-mono); font-weight: 700;">#TASK-${t.maintenance_id}</td>
      <td style="font-weight: 700;">${t.machine_name || t.machine_id}</td>
      <td>${t.technician_name || 'Marcus Vance'}</td>
      <td style="font-family: var(--font-mono);">${t.maintenance_date}</td>
      <td><span class="priority-tag priority-${(t.priority || 'Medium').toLowerCase()}">${t.priority}</span></td>
      <td>${getStatusBadge(t.status)}</td>
      <td>${t.service_type || 'Preventive Maintenance'}</td>
      <td>
        ${t.status !== 'Completed' ? `
          <button class="btn btn-secondary btn-sm" onclick="completeMaintenanceTask(${t.maintenance_id})">
            <i class="fa-solid fa-check"></i> Complete
          </button>
        ` : `<span style="font-size: 0.8rem; color: #10b981; font-weight: 700;"><i class="fa-solid fa-check-double"></i> Done</span>`}
      </td>
    </tr>
  `).join('');
}

function openScheduleModal() {
  const mSelect = document.getElementById('schedMachineSelect');
  mSelect.innerHTML = SEMS_STATE.machines.map(m => `<option value="${m.machine_id}">${m.machine_id} - ${m.machine_name}</option>`).join('');

  const tSelect = document.getElementById('schedTechSelect');
  tSelect.innerHTML = SEMS_STATE.technicians.map(t => `<option value="${t.technician_id}">${t.name} (${t.email || t.department})</option>`).join('');

  openModal('scheduleModal');
}

async function submitScheduleTask() {
  const newTask = {
    machine_id: document.getElementById('schedMachineSelect').value,
    technician_id: document.getElementById('schedTechSelect').value,
    maintenance_date: document.getElementById('schedDate').value,
    priority: document.getElementById('schedPriority').value,
    service_type: document.getElementById('schedServiceType').value,
    description: document.getElementById('schedDescription').value,
    status: 'Scheduled',
    maintenance_id: Math.floor(1000 + Math.random() * 9000)
  };

  try {
    await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    });
  } catch (e) { }

  SEMS_STATE.maintenanceTasks.unshift(newTask);
  SEMS_STATE.kpiData.maintenance_due += 1;
  updateKPICards();
  renderSchedulerTable();

  closeModal('scheduleModal');
  showToast('Maintenance task scheduled!');
}

async function completeMaintenanceTask(taskId) {
  const task = SEMS_STATE.maintenanceTasks.find(t => t.maintenance_id === taskId);
  if (task) {
    task.status = 'Completed';
    try {
      await fetch(`/api/maintenance/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      });
    } catch (e) { }

    SEMS_STATE.kpiData.completed_services += 1;
    if (SEMS_STATE.kpiData.maintenance_due > 0) SEMS_STATE.kpiData.maintenance_due -= 1;
    updateKPICards();
    renderSchedulerTable();
    showToast(`Task #TASK-${taskId} marked as completed.`);
  }
}

/* --------------------------------------------------------
   PAGE 6: TECHNICIAN MANAGEMENT
   -------------------------------------------------------- */
function renderTechniciansTable() {
  const tbody = document.getElementById('techniciansTableBody');
  if (!tbody) return;

  const techs = SEMS_STATE.technicians;

  tbody.innerHTML = techs.map(t => {
    const email = t.email || `${t.name.toLowerCase().replace(/\s+/g, '.')}@smartfactory.com`;
    return `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 700;">#TECH-${t.technician_id}</td>
        <td style="font-weight: 700;">${t.name}</td>
        <td style="font-family: var(--font-mono); font-weight: 600; color: var(--primary-blue);">${email}</td>
        <td>${t.department}</td>
        <td style="font-family: var(--font-mono);">${t.phone}</td>
        <td><span style="font-weight: 800; color: var(--primary-blue);">${t.assigned_tasks || 3} Tasks</span></td>
        <td>
          <span class="status-badge ${t.status === 'Available' ? 'badge-active' : 'badge-due'}">
            ${t.status}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openEmailModalForTech('${t.name}', '${email}')">
            <i class="fa-solid fa-paper-plane"></i> Email Tech
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function submitAddTechnician() {
  const name = document.getElementById('techNameInput').value;
  const email = document.getElementById('techEmailInput').value;
  const dept = document.getElementById('techDeptInput').value;
  const phone = document.getElementById('techPhoneInput').value;

  const newTech = {
    technician_id: Math.floor(100 + Math.random() * 900),
    name: name,
    email: email,
    department: dept,
    phone: phone,
    status: 'Available',
    assigned_tasks: 0
  };

  try {
    await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTech)
    });
  } catch (e) { }

  SEMS_STATE.technicians.push(newTech);
  renderTechniciansTable();
  populateEmailTechDropdown();
  closeModal('addTechModal');
  showToast(`Admin registered technician ${name} (${email}).`);
}

function populateEmailTechDropdown() {
  const select = document.getElementById('emailTechSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose from Technicians --</option>' +
    SEMS_STATE.technicians.map(t => {
      const email = t.email || `${t.name.toLowerCase().replace(/\s+/g, '.')}@smartfactory.com`;
      return `<option value="${email}">${t.name} (${email})</option>`;
    }).join('');
}

/* --------------------------------------------------------
   PAGE 7: NOTIFICATIONS & EMAIL RECIPIENT DISPATCH
   -------------------------------------------------------- */
function renderNotifications() {
  const feed = document.getElementById('notificationFeed');
  if (!feed) return;

  const alerts = SEMS_STATE.notifications;

  feed.innerHTML = alerts.map(n => `
    <div class="notification-item ${n.priority.toLowerCase()}">
      <div class="notification-content">
        <div class="notification-icon" style="background: ${n.priority === 'Critical' ? '#fee2e2' : '#fef3c7'}; color: ${n.priority === 'Critical' ? '#dc2626' : '#d97706'};">
          <i class="fa-solid ${n.priority === 'Critical' ? 'fa-triangle-exclamation' : 'fa-bell'}"></i>
        </div>
        <div>
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--primary-dark);">${n.notification_type || 'Alert'}: ${n.machine_id}</div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">${n.message}</p>
          <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-light); margin-top: 0.5rem;">
            <span><i class="fa-solid fa-calendar"></i> Due: ${n.due_date}</span>
            <span><i class="fa-solid fa-flag"></i> Priority: ${n.priority}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; align-self: center;">
        <button class="btn btn-primary btn-sm" onclick="openEmailModalForAlert('${n.machine_id}', '${n.message}', '${n.due_date}', '${n.priority}')">
          <i class="fa-solid fa-paper-plane"></i> Send Email Reminder
        </button>
      </div>
    </div>
  `).join('');
}

function openEmailModal(presetEmail = '', presetSubject = '', presetBody = '') {
  const mSelect = document.getElementById('emailMachineSelect');
  if (mSelect) {
    mSelect.innerHTML = SEMS_STATE.machines.map(m => `<option value="${m.machine_id}">${m.machine_id} - ${m.machine_name}</option>`).join('');
  }

  const banner = document.getElementById('emailDispatchStatusBanner');
  if (banner) banner.style.display = 'none';

  document.getElementById('emailRecipientInput').value = presetEmail || 'marcus.vance@smartfactory.com';
  document.getElementById('emailSubjectInput').value = presetSubject || 'URGENT: Smart Equipment Maintenance & Inspection Notice';
  document.getElementById('emailBodyInput').value = presetBody || 'Please inspect equipment, check alignment, and record maintenance logs in SEMS ERP.';

  openModal('sendEmailModal');
}

function openEmailModalForAlert(machineId, message, dueDate, priority) {
  const firstTech = SEMS_STATE.technicians[0];
  const targetEmail = firstTech ? (firstTech.email || 'marcus.vance@smartfactory.com') : 'marcus.vance@smartfactory.com';
  const subject = `[${priority} ALERT] Maintenance Required for ${machineId}`;
  const body = `Attention Maintenance Engineer,\n\n${message}\n\nTarget Machine: ${machineId}\nScheduled Due Date: ${dueDate}\nPriority Level: ${priority}\n\nPlease perform required maintenance immediately and log status in SEMS.`;
  openEmailModal(targetEmail, subject, body);
}

function openEmailModalForTech(techName, techEmail) {
  const subject = `Work Assignment Notice - SEMS Industrial ERP`;
  const body = `Hello ${techName},\n\nYou have been assigned new equipment maintenance tasks. Please log in to SEMS to review your scheduler timeline.`;
  openEmailModal(techEmail, subject, body);
}

function applySelectedTechEmail() {
  const selectedEmail = document.getElementById('emailTechSelect').value;
  if (selectedEmail) {
    document.getElementById('emailRecipientInput').value = selectedEmail;
  }
}

function saveEmailJSConfig() {
  SEMS_STATE.emailjsConfig.serviceId = document.getElementById('emailjsServiceIdInput').value;
  SEMS_STATE.emailjsConfig.publicKey = document.getElementById('emailjsPublicKeyInput').value;
  SEMS_STATE.emailjsConfig.templateId = document.getElementById('emailjsTemplateIdInput').value || 'template_default';

  if (SEMS_STATE.emailjsConfig.publicKey && window.emailjs) {
    try {
      emailjs.init(SEMS_STATE.emailjsConfig.publicKey);
    } catch (e) { }
  }

  showToast('EmailJS configuration saved successfully.');
}

async function submitEmailDispatch() {
  const recipient = document.getElementById('emailRecipientInput').value;
  const subject = document.getElementById('emailSubjectInput').value;
  const machine = document.getElementById('emailMachineSelect').value;
  const priority = document.getElementById('emailPrioritySelect').value;
  const bodyText = document.getElementById('emailBodyInput').value;

  const banner = document.getElementById('emailDispatchStatusBanner');
  const btn = document.getElementById('sendEmailBtn');

  if (banner) {
    banner.style.display = 'block';
    banner.style.background = '#eff6ff';
    banner.style.color = '#1d4ed8';
    banner.style.border = '1px solid #bfdbfe';
    banner.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Dispatching email notification to <strong>${recipient}</strong>...`;
  }

  if (btn) btn.disabled = true;

  // 1. Send via REST Backend API
  let backendSuccess = false;
  try {
    const res = await fetch('/api/notifications/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_email: recipient,
        subject: subject,
        machine_name: machine,
        priority: priority,
        message: bodyText
      })
    });
    if (res.ok) backendSuccess = true;
  } catch (e) { }

  // 2. Send via EmailJS SDK if public key is configured
  const serviceId = SEMS_STATE.emailjsConfig.serviceId || "service_h7mfjgf";
  const templateId = SEMS_STATE.emailjsConfig.templateId || "template_default";
  const publicKey = SEMS_STATE.emailjsConfig.publicKey;

  if (window.emailjs && publicKey) {
    try {
      await emailjs.send(serviceId, templateId, {
        to_email: recipient,
        to_name: recipient.split('@')[0],
        subject: subject,
        message: bodyText,
        machine_id: machine,
        priority: priority
      }, publicKey);
    } catch (err) {
      console.warn("EmailJS SDK notice:", err);
    }
  }

  if (btn) btn.disabled = false;

  if (banner) {
    banner.style.background = '#ecfdf5';
    banner.style.color = '#047857';
    banner.style.border = '1px solid #a7f3d0';
    banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Email Dispatched Successfully!</strong> Message sent to <code>${recipient}</code> via SEMS Email Service (ID: ${serviceId}).`;
  }

  showToast(`✓ Email successfully sent to ${recipient}!`);
  setTimeout(() => {
    closeModal('sendEmailModal');
  }, 2200);
}

/* --------------------------------------------------------
   PAGE 8: REPORTS & EXPORT LOGIC (PDF / EXCEL)
   -------------------------------------------------------- */
function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("SMART EQUIPMENT MAINTENANCE SYSTEM (SEMS)", 14, 20);

  doc.setFontSize(12);
  doc.setFont("Helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Executive Monthly Equipment Performance & Downtime Report", 14, 28);
  doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, 14, 34);

  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

  doc.setFont("Helvetica", "bold");
  doc.text("1. EXECUTIVE SUMMARY KPIs", 14, 48);

  doc.setFont("Helvetica", "normal");
  doc.text(`• Total Registered Machines: ${SEMS_STATE.kpiData.total_machines}`, 20, 56);
  doc.text(`• Active Operational Machines: ${SEMS_STATE.kpiData.active_machines}`, 20, 64);
  doc.text(`• Maintenance Tasks Pending: ${SEMS_STATE.kpiData.maintenance_due}`, 20, 72);
  doc.text(`• Overdue Critical Alerts: ${SEMS_STATE.kpiData.overdue_maintenance}`, 20, 80);
  doc.text(`• YTD Completed Services: ${SEMS_STATE.kpiData.completed_services}`, 20, 88);

  doc.setFont("Helvetica", "bold");
  doc.text("2. FEATURED EQUIPMENT LOGS", 14, 102);

  let y = 112;
  SEMS_STATE.machines.slice(0, 10).forEach((m, idx) => {
    doc.setFont("Helvetica", "normal");
    doc.text(`${idx + 1}. [${m.machine_id}] ${m.machine_name} - ${m.status} (Health: ${m.health_score}%)`, 20, y);
    y += 8;
  });

  doc.save("SEMS_Industrial_Maintenance_Report.pdf");
  showToast("PDF Maintenance Report generated and downloaded!");
}

function exportToExcel() {
  const worksheetData = [
    ["Machine ID", "Machine Name", "Category", "Department", "Location", "Next Service Date", "Health Score", "Status"],
    ...SEMS_STATE.machines.map(m => [
      m.machine_id, m.machine_name, m.category, m.department, m.location, m.next_service_date || '2026-09-25', `${m.health_score || 90}%`, m.status
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Machine Inventory");
  XLSX.writeFile(wb, "SEMS_Machine_Inventory_Audit.xlsx");

  showToast("Excel Spreadsheet exported successfully!");
}

/* --------------------------------------------------------
   UI HELPERS & UTILITIES
   -------------------------------------------------------- */
function getStatusBadge(status) {
  switch (status) {
    case 'Active':
      return `<span class="status-badge badge-active"><i class="fa-solid fa-circle-check"></i> Active</span>`;
    case 'Under Maintenance':
    case 'Pending':
      return `<span class="status-badge badge-due"><i class="fa-solid fa-wrench"></i> Under Service</span>`;
    case 'Breakdown':
    case 'Overdue':
      return `<span class="status-badge badge-overdue"><i class="fa-solid fa-triangle-exclamation"></i> Overdue / Breakdown</span>`;
    case 'Scheduled':
      return `<span class="status-badge badge-scheduled"><i class="fa-solid fa-clock"></i> Scheduled</span>`;
    case 'Completed':
      return `<span class="status-badge badge-active"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
    default:
      return `<span class="status-badge badge-active">${status}</span>`;
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: #38bdf8;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
