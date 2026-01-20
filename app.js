// --- CSV Loader Logic (Integrated for local file usage) ---
function loadCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const text = e.target.result;
            const data = parseCSVText(text);
            resolve(data);
        };

        reader.onerror = () => reject(new Error('File read error'));

        // Read as text
        reader.readAsText(file);
    });
}

function parseCSVText(text) {
    // Remove BOM if present
    const content = text.replace(/^\uFEFF/, '');

    const lines = content.split(/\r?\n/);
    const expenses = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = splitCSVLine(line);

        // Check if valid data line (contains year like 2025)
        if (!cols[0] || !cols[0].match(/^\d{4}$/)) {
            continue;
        }

        // Schema Mapping: 0:Year, 1:Month, 2:Day, 3:Type, 4:MidCat, 5:SmallCat, 6:Detail, 7:Amount, 8:ValueType, 9:Payee, 10:Method
        const year = cols[0];
        const month = cols[1].padStart(2, '0');
        const day = cols[2].padStart(2, '0');

        const item = {
            id: crypto.randomUUID(),
            date: `${year}-${month}-${day}`,
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            type: cols[3],
            category_med: cols[4],
            category_sml: cols[5],
            detail: cols[6],
            amount: parseAmount(cols[7]),
            value_type: cols[8],
            payee: cols[9],
            method: cols[10]
        };

        expenses.push(item);
    }

    return expenses;
}

function parseAmount(str) {
    if (!str) return 0;
    const clean = str.replace(/["',]/g, '').trim();
    return parseInt(clean) || 0;
}

function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// --- Application Logic ---

// State
let transactions = [];
let filteredTransactions = [];

// DOM Elements
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-links li');
const fileInput = document.getElementById('csv-input');
const importBtn = document.getElementById('import-btn');

// --- Modal & Entry Logic ---
const modal = document.getElementById('entry-modal');
const entryForm = document.getElementById('entry-form');
const addBtn = document.getElementById('add-btn');
const closeBtn = document.getElementById('close-modal');

function initModalListeners() {
    addBtn.addEventListener('click', () => {
        modal.classList.add('active');
        // Set default date to today
        document.getElementById('entry-date').valueAsDate = new Date();
    });

    const dayDetailModal = document.getElementById('day-detail-modal');
    if (dayDetailModal) {
        dayDetailModal.addEventListener('click', (e) => {
            if (e.target === dayDetailModal) {
                dayDetailModal.classList.remove('active');
            }
        });
        document.getElementById('close-day-detail').addEventListener('click', () => {
            dayDetailModal.classList.remove('active');
        });
    }

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    entryForm.addEventListener('submit', handleEntrySubmit);
}

function handleEntrySubmit(e) {
    e.preventDefault();

    const dateVal = document.getElementById('entry-date').value;
    const type = document.getElementById('entry-type').value;
    const amount = parseInt(document.getElementById('entry-amount').value);
    const categoryMed = document.getElementById('entry-category-med').value;
    const detail = document.getElementById('entry-detail').value;
    const method = document.getElementById('entry-method').value;
    const valueType = document.getElementById('entry-value-type').value;

    if (!dateVal || isNaN(amount)) return;

    // Parse date parts
    const [year, month, day] = dateVal.split('-').map(Number);

    const newItem = {
        id: crypto.randomUUID(),
        date: dateVal,
        year: year,
        month: month,
        day: day,
        type: type,
        category_med: categoryMed,
        category_sml: '', // Optional for manual entry for now
        detail: detail,
        amount: amount,
        value_type: valueType,
        payee: '',
        method: method
    };

    // Add to state
    transactions.unshift(newItem); // Add to top
    saveToStorage();

    // Refresh UI
    filterTransactions(); // Will resort
    renderDashboard();

    // Close & Reset
    modal.classList.remove('active');
    entryForm.reset();

    alert('登録しました！');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initModalListeners();
    initCalendarListeners();
    initLockSystem(); // Lock System
    loadFromStorage();
    renderDashboard();
});

// --- Event Listeners ---
function initEventListeners() {
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetView = link.dataset.view;
            switchView(targetView);
        });
    });

    // CSV Import
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Filters
    // Dashboard Month Picker
    const dashboardPicker = document.getElementById('dashboard-month-picker');
    if (dashboardPicker) {
        dashboardPicker.addEventListener('change', renderDashboard);
    }

    // Transaction View Filters
    const transMonthPicker = document.getElementById('month-picker');
    const typeFilter = document.getElementById('type-filter');
    const searchInput = document.getElementById('search-input');

    if (transMonthPicker) transMonthPicker.addEventListener('change', filterTransactions);
    if (typeFilter) typeFilter.addEventListener('change', filterTransactions);
    if (searchInput) searchInput.addEventListener('input', filterTransactions);
}

// --- Navigation Logic ---
function switchView(viewName) {
    // Update active state in Nav
    navLinks.forEach(link => {
        if (link.dataset.view === viewName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update View Area
    views.forEach(view => {
        if (view.id === `view-${viewName}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    // Show/Hide Dashboard controls
    const dashboardControls = document.getElementById('dashboard-controls');
    if (dashboardControls) {
        dashboardControls.style.display = viewName === 'dashboard' ? 'block' : 'none';
    }

    // Update Header Title
    // ... (rest is same)
    const titles = {
        'dashboard': 'ダッシュボード',
        'transactions': '取引一覧',
        'analytics': '分析レポート',
        'calendar': 'カレンダー'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'Zaim Log';

    if (viewName === 'transactions') {
        renderTransactionsTable();
        // Sync filter?
    } else if (viewName === 'calendar') {
        renderCalendar();
    }
}

// --- Data Handling ---
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const loadedData = await loadCSV(file);
        transactions = loadedData;
        saveToStorage();
        alert(`${transactions.length} 件のデータを読み込みました`);

        // Refresh UI
        filterTransactions();
        renderDashboard();
        renderTransactionsTable();
    } catch (err) {
        console.error(err);
        alert('CSVの読み込みに失敗しました: ' + err.message);
    }
}

function saveToStorage() {
    localStorage.setItem('zaim_transactions', JSON.stringify(transactions));
}

function loadFromStorage() {
    const saved = localStorage.getItem('zaim_transactions');
    if (saved) {
        transactions = JSON.parse(saved);
        filterTransactions(); // Initialize filtered list
    }
}

// --- Rendering Logic ---

let currentDashboardMonth = '';

function getLatestMonth(data) {
    if (!data || data.length === 0) return '';
    // Sort by date desc to find latest
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    // Return YYYY-MM
    return sorted[0].date.substring(0, 7);
}

function filterTransactions() {
    const type = document.getElementById('type-filter').value;
    const search = document.getElementById('search-input').value.toLowerCase();
    const monthPicker = document.getElementById('month-picker').value;

    filteredTransactions = transactions.filter(t => {
        const matchType = type === 'all' || (type === '支出' && t.type === '支出') || (type === '収入' && t.type === '収入');
        const matchSearch = (t.detail || '').toLowerCase().includes(search) ||
            (t.category_med || '').toLowerCase().includes(search) ||
            (t.payee || '').toLowerCase().includes(search);

        // Month filter
        const matchMonth = monthPicker ? t.date.startsWith(monthPicker) : true;

        return matchType && matchSearch && matchMonth;
    });

    // Sort by date desc
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    renderTransactionsTable();
}

function renderDashboard() {
    // 1. Controls Display
    const controls = document.getElementById('dashboard-controls');
    if (controls) controls.style.display = 'block';

    const picker = document.getElementById('dashboard-month-picker');

    if (transactions.length === 0) {
        document.getElementById('current-month-income').textContent = '¥0';
        document.getElementById('current-month-expense').textContent = '¥0';
        document.getElementById('current-month-balance').textContent = '¥0';
        if (picker) picker.value = '';
        return;
    }

    // 2. Determine Month
    let targetMonth = picker ? picker.value : '';

    if (!targetMonth) {
        // If no picker value (initial load), try to use state or default to latest data
        if (!currentDashboardMonth) {
            currentDashboardMonth = getLatestMonth(transactions);
        }
        targetMonth = currentDashboardMonth;

        // Auto-set picker to show user which month is displayed
        if (picker) picker.value = targetMonth;
    } else {
        // User picked a month, update state
        currentDashboardMonth = targetMonth;
    }

    // 3. Filter Data
    const currentMonthData = transactions.filter(t => t.date.startsWith(targetMonth));

    // 4. Calculate Stats
    const income = currentMonthData
        .filter(t => t.type === '収入')
        .reduce((sum, t) => sum + t.amount, 0);

    const expense = currentMonthData
        .filter(t => t.type === '支出')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    // 5. Update DOM
    document.getElementById('current-month-income').textContent = `¥${income.toLocaleString()}`;
    document.getElementById('current-month-expense').textContent = `¥${expense.toLocaleString()}`;
    document.getElementById('current-month-balance').textContent = `¥${balance.toLocaleString()}`;

    // 6. Update Charts & List
    renderRecentTransactionsList(currentMonthData);
    renderCharts(currentMonthData);
}

function renderRecentTransactionsList(data) {
    const list = document.getElementById('recent-list');
    list.innerHTML = '';

    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (sorted.length === 0) {
        list.innerHTML = '<li style="padding:1rem; color:var(--text-secondary); text-align:center;">この月の取引はありません</li>';
        return;
    }

    sorted.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction-item';

        const isExpense = t.type === '支出';
        const sign = isExpense ? '-' : '+';
        const amountClass = isExpense ? 'expense' : 'income';
        const icon = getCategoryIcon(t.category_med);

        li.innerHTML = `
            <div class="t-left">
                <div class="t-icon">${icon}</div>
                <div class="t-info">
                    <h4>${escapeHTML(t.detail || t.category_med)}</h4>
                    <span>${escapeHTML(t.date)} • ${escapeHTML(t.payee || '---')}</span>
                </div>
            </div>
            <div class="t-amount ${amountClass}">
                ${sign}¥${t.amount.toLocaleString()}
            </div>
        `;
        list.appendChild(li);
    });
}

// Keep a stub if anything calls this directly, but redirect to dashboard logic
function renderRecentTransactions() {
    renderDashboard();
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transaction-table-body');
    tbody.innerHTML = '';

    // Show top 50 for performance if list is huge
    const displayList = filteredTransactions.slice(0, 50);

    displayList.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(t.date)}</td>
            <td>${escapeHTML(t.detail)}</td>
            <td>${escapeHTML(t.category_med)} <span style="color:var(--text-secondary); font-size:0.8em">(${escapeHTML(t.category_sml || '-')})</span></td>
            <td>¥${t.amount.toLocaleString()}</td>
            <td>${escapeHTML(t.payee || '-')}</td>
            <td style="text-align: right;">
                <button class="btn-icon delete-btn" onclick="deleteTransaction('${escapeHTML(t.id)}')" aria-label="削除">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global expose for onclick
window.deleteTransaction = function (id) {
    if (!confirm('この取引を削除しますか？')) return;

    transactions = transactions.filter(t => t.id !== id);
    saveToStorage();

    // Refresh Logic
    filterTransactions();
    renderDashboard();
};


// --- Calendar Logic ---
let calCurrentDate = new Date();

function initCalendarListeners() {
    document.getElementById('cal-prev-btn').addEventListener('click', () => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('cal-next-btn').addEventListener('click', () => {
        calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
        renderCalendar();
    });
}

function renderCalendar() {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth(); // 0-indexed

    // Update Header
    document.getElementById('cal-current-month').textContent = `${year}年 ${month + 1}月`;

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // First day of the month (0=Sun, 1=Mon, ...)
    const firstDay = new Date(year, month, 1).getDay();
    // Number of days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Data Aggregation
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthData = transactions.filter(t => t.date.startsWith(monthStr));
    const dailyData = {}; // day -> { income: 0, expense: 0 }

    monthData.forEach(t => {
        const d = t.day;
        if (!dailyData[d]) dailyData[d] = { income: 0, expense: 0 };
        if (t.type === '収入') dailyData[d].income += t.amount;
        else if (t.type === '支出') dailyData[d].expense += t.amount;
    });

    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        grid.appendChild(cell);
    }

    // Days
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        if (isCurrentMonth && day === today.getDate()) {
            cell.classList.add('today');
        }

        const data = dailyData[day];
        let totalsHtml = '';
        if (data) {
            if (data.income > 0) {
                totalsHtml += `<div class="day-total inc"><span>¥${data.income.toLocaleString()}</span></div>`;
            }
            if (data.expense > 0) {
                totalsHtml += `<div class="day-total exp"><span>¥${data.expense.toLocaleString()}</span></div>`;
            }
        }

        cell.innerHTML = `
            <div class="date-number">${day}</div>
            ${totalsHtml}
        `;

        // Add click listener
        cell.addEventListener('click', () => openDayDetail(year, month, day));

        grid.appendChild(cell);
    }
}

function openDayDetail(year, month, day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = transactions.filter(t => t.date === dateStr);

    // Sort by type (Income first) then amount desc
    dayData.sort((a, b) => {
        if (a.type !== b.type) return a.type === '収入' ? -1 : 1;
        return b.amount - a.amount;
    });

    // Update Modal Content
    document.getElementById('day-detail-title').textContent = `${year}年 ${month + 1}月 ${day}日`;

    const list = document.getElementById('day-detail-list');
    list.innerHTML = '';

    if (dayData.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">この日の取引はありません</div>';
    } else {
        dayData.forEach(t => {
            const li = document.createElement('div');
            li.className = 'transaction-item'; // Reuse existing class

            const isExpense = t.type === '支出';
            const sign = isExpense ? '-' : '+';
            const amountClass = isExpense ? 'expense' : 'income';
            const icon = getCategoryIcon(t.category_med);

            li.innerHTML = `
                <div class="t-left">
                    <div class="t-icon">${icon}</div>
                    <div class="t-info">
                        <h4>${escapeHTML(t.detail || t.category_med)}</h4>
                        <span>${escapeHTML(t.category_sml || t.type)} • ${escapeHTML(t.payee || '')}</span>
                    </div>
                </div>
                <div class="t-amount ${amountClass}">
                    ${sign}¥${t.amount.toLocaleString()}
                </div>
            `;
            list.appendChild(li);
        });
    }

    // Show Modal
    const modal = document.getElementById('day-detail-modal');
    modal.classList.add('active');
}


// --- Lock System Logic ---
let pinCode = '';
let isSettingUp = false;
let tempPin = '';

function initLockSystem() {
    const savedPin = localStorage.getItem('zaim_pin');
    const lockScreen = document.getElementById('lock-screen');
    const lockBtn = document.getElementById('lock-setup-btn');
    const pinInput = document.getElementById('pin-input');

    // UI Update for Button
    updateLockButtonUI();

    // Check if locked
    if (savedPin) {
        // Enforce lock on load
        lockScreen.style.display = 'flex';
        resetPinState();
    }

    // Keypad Logic
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', () => {
            const num = key.dataset.num;
            if (num !== undefined) addPinDigit(num);
        });
    });

    document.getElementById('key-delete').addEventListener('click', removePinDigit);

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (lockScreen.style.display === 'none') return;
        if (e.key >= '0' && e.key <= '9') addPinDigit(e.key);
        if (e.key === 'Backspace') removePinDigit();
    });

    // Setup Button
    lockBtn.addEventListener('click', () => {
        if (localStorage.getItem('zaim_pin')) {
            // Already set -> Ask to remove or Lock?
            // For simplicity: Click to Lock manually
            lockScreen.style.display = 'flex';
            resetPinState();
        } else {
            // Start Setup
            startPinSetup();
        }
    });
}

function updateLockButtonUI() {
    const savedPin = localStorage.getItem('zaim_pin');
    const lockBtn = document.getElementById('lock-setup-btn');
    const icon = lockBtn.querySelector('span');
    if (savedPin) {
        icon.textContent = 'lock';
        lockBtn.title = 'アプリをロック';
    } else {
        icon.textContent = 'lock_open';
        lockBtn.title = 'パスワード設定';
    }
}

function startPinSetup() {
    isSettingUp = true;
    tempPin = '';
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.style.display = 'flex';
    document.getElementById('lock-title').textContent = 'パスワード設定';
    document.getElementById('lock-message').textContent = '新しいPINコード(4桁)を入力';
    resetPinState();
}

function addPinDigit(digit) {
    if (pinCode.length >= 4) return;

    pinCode += digit;
    updatePinDisplay();

    if (pinCode.length === 4) {
        setTimeout(handlePinComplete, 100);
    }
}

function removePinDigit() {
    if (pinCode.length > 0) {
        pinCode = pinCode.slice(0, -1);
        updatePinDisplay();
    }
}

function updatePinDisplay() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        if (index < pinCode.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
        dot.classList.remove('error');
    });
}

function resetPinState() {
    pinCode = '';
    updatePinDisplay();
}

function handlePinComplete() {
    const savedPin = localStorage.getItem('zaim_pin');
    const title = document.getElementById('lock-title');
    const msg = document.getElementById('lock-message');

    if (isSettingUp) {
        // Setup Mode
        if (!tempPin) {
            // First entry done, ask confirm
            tempPin = pinCode;
            resetPinState();
            msg.textContent = '確認のためもう一度入力';
        } else {
            // Confirmation
            if (pinCode === tempPin) {
                // Success
                localStorage.setItem('zaim_pin', pinCode);
                alert('パスワードを設定しました');
                document.getElementById('lock-screen').style.display = 'none';
                isSettingUp = false;
                tempPin = '';
                updateLockButtonUI();
            } else {
                // Mismatch
                showError('パスワードが一致しません');
                tempPin = '';
                msg.textContent = '新しいPINコード(4桁)を入力';
            }
        }
    } else {
        // Unlock Mode
        if (pinCode === savedPin) {
            // Success
            document.getElementById('lock-screen').style.display = 'none';
        } else {
            // Fail
            showError();
        }
    }
}

function showError(text) {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(dot => dot.classList.add('error'));

    // Shake animation effect could go here
    setTimeout(() => {
        resetPinState();
    }, 400);
}


// --- Helpers ---
// Security Helper
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function (match) {
        const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escape[match];
    });
}

let categoryChartInstance = null;

function renderCharts(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    // Group expenses by category_med
    const expenses = data.filter(t => t.type === '支出');
    const totals = {};
    expenses.forEach(t => {
        totals[t.category_med] = (totals[t.category_med] || 0) + t.amount;
    });

    const labels = Object.keys(totals);
    const chartData = Object.values(totals);

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: [
                    '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8' }
                }
            }
        }
    });
}

function getCategoryIcon(category) {
    const map = {
        '食費': 'restaurant',
        '飲料費': 'coffee',
        '酒代': 'wine_bar',
        '日用品費': 'shopping_bag',
        '日用品': 'shopping_bag', // 旧互換
        '交通費': 'train',
        '交際費': 'groups',
        '娯楽費': 'movie',
        '教育費': 'school',
        '習い事': 'piano',
        '書籍': 'menu_book',
        '住居費': 'home',
        '水道光熱費': 'water_drop',
        '通信費': 'wifi',
        '保険料': 'health_and_safety',
        '社会保険': 'shield',
        '社会保険料': 'shield',
        '税金': 'gavel',
        '投資': 'trending_up',
        '特別費': 'star',
        '雑費': 'box',
        '給与': 'payments',
        '賞与': 'stars',
        '手当': 'attach_money',
        '副業収入': 'work',
        '副収入': 'monetization_on',
        '臨時収入': 'savings',
        'その他': 'more_horiz'
    };
    return `<span class="material-symbols-rounded">${map[category] || 'payments'}</span>`;
}

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
