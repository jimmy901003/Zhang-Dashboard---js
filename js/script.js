
// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDDEOqfcwmJiti_HZqOyri4qWUFWbtCUh0",
    authDomain: "popo-database.firebaseapp.com",
    projectId: "popo-database",
    storageBucket: "popo-database.appspot.com",
    messagingSenderId: "825813869113",
    appId: "1:825813869113:web:90d32426d03df5cb30a3e8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const fakeFirestoreData = [
    {
        fileNumber: "001",
        userName: "張三",
        totalCost: 5000,
        payments: [
            { type: 'deposit', method: 'cash', amount: 2000, timestamp: '2024-09-03T00:00:00Z' },
            { type: 'refundtoUser', method: 'cash', amount: -1000, timestamp: '2024-09-03T00:00:00Z' },
            { type: 'firstPayment', method: 'transfer', amount: 2000, timestamp: '2024-09-05T00:00:00Z' },
            { type: 'finalPayment', method: 'cash', amount: 1500, timestamp: '2024-09-1T00:00:00Z' },
            { type: 'refundtoUser', method: 'transfer', amount: -500, timestamp: '2024-08-1T00:00:00Z' }
        ],
        isSealed: false,
        contractPerson: "李四",
        dueDate: "2024-09-01",
        note: "特殊要求",
        note2: "方案"
    },
    // More fake data here
];


// Global variables
let firestoreData = [];
const paymentTypes = ['deposit', 'firstPayment', 'finalPayment', 'renewalFinalPayment', 'refundtoUser'];
const paymentTypesChinese = {
    'deposit': '訂金',
    'firstPayment': '頭款',
    'finalPayment': '尾款',
    'renewalFinalPayment': '續訂尾款',
    'refundtoUser': '退費'
};
const paymentMethodsChinese = {
    'cash': '現金',
    'transfer': '匯款',
    'pending': '待付款',
    'cheque': '支票',
};
const typeColors = {
    '訂金': '#ffd166',
    '頭款': '#118ab2',
    '尾款': '#06d6a0',
    '續訂尾款': '#073b4c',
    '未支付': '#ef476f'
};

// DOM elements
const dateTypeRadios = document.querySelectorAll('input[name="dateType"]');
const selectedDateInput = document.getElementById('selectedDate');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const orderStatusRadios = document.querySelectorAll('input[name="orderStatus"]');
const reloadDataButton = document.getElementById('reloadData');
const orderList = document.getElementById('orderList'); 

// Event listeners
dateTypeRadios.forEach(radio => radio.addEventListener('change', updateDatePickers));
selectedDateInput.addEventListener('change', updateData);
startDateInput.addEventListener('change', updateData);
endDateInput.addEventListener('change', updateData);
orderStatusRadios.forEach(radio => radio.addEventListener('change', updateData));
reloadDataButton.addEventListener('click', reloadData);

// Helper functions
function parseDate(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function parseAmount(amountStr) {
    return parseFloat(amountStr.replace(/[$,]/g, '').trim()) || 0;
}


// Initialize date pickers
function initDatePickers() {
    const today = new Date();
    selectedDateInput.value = today.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];
    startDateInput.value = new Date(today - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// Update date pickers based on selected date type
function updateDatePickers() {
    const dateType = document.querySelector('input[name="dateType"]:checked').value;
    if (dateType === '單日') {
        selectedDateInput.style.display = 'block';
        startDateInput.style.display = 'none';
        endDateInput.style.display = 'none';
    } else {
        selectedDateInput.style.display = 'none';
        startDateInput.style.display = 'block';
        endDateInput.style.display = 'block';
    }
    updateData();
}

// Update data and UI based on current filters
function updateData() {
    if (firestoreData.length > 0) {
        processData();
    } else {
        fetchFirestoreData();
    }
}

// Fetch data from Firestore
async function fetchFirestoreData() {
    try {
        const snapshot = await db.collection('calculations').get();
        firestoreData = snapshot.docs.map(doc => ({
            id: doc.id,  // 確保包含文檔 ID
            ...doc.data()
        }));
        processData();
    } catch (error) {
        console.error("Error fetching Firestore data:", error);
        orderList.innerHTML = '<p class="error">Error fetching data. Please try again later.</p>';
    }
}

// Process and flatten the data
function processData() {
    const flatData = firestoreData.map(item => {
        const flatItem = {...item, ...item.hospitalMeals, ...item.ourMeals};
        
        paymentTypes.forEach(paymentType => {
            flatItem[`${paymentType}_amount`] = 0;
            flatItem[`${paymentType}_info`] = '';
        });
        
        const payments = item.payments || [];
        const filteredPayments = payments.filter(p => p.method !== 'pending');
        
        filteredPayments.forEach(payment => {
            if (paymentTypes.includes(payment.type)) {
                // Handle payments
                if (payment.type !== 'refundtoUser') {
                    flatItem[`${payment.type}_amount`] += payment.amount;
                }
                const timestamp = payment.timestamp.substr(0, 10);
                const methodChinese = paymentMethodsChinese[payment.method] || payment.method;
                const info = `$ ${payment.amount.toLocaleString()} (${timestamp} ${methodChinese})`;
                flatItem[`${payment.type}_info`] += `${info}\n`;
            }
        });
        
        // Handle refunds separately
        const refunds = payments.filter(p => p.type === 'refundtoUser');
        flatItem['refundtoUser_amount'] = refunds.reduce((sum, r) => sum + r.amount, 0);
        flatItem['refundtoUser_info'] = refunds.map(r => `$ ${Math.abs(r.amount).toLocaleString()} (${r.timestamp.substr(0, 10)} ${paymentMethodsChinese[r.method] || r.method})`).join('\n');
        flatItem.memo = item.memo || '';
        return flatItem;
    });
    
    updateUI(flatData);
}

// Update the UI with processed data

function updateUI(data) {
    const dateType = document.querySelector('input[name="dateType"]:checked').value;
    const orderStatus = document.querySelector('input[name="orderStatus"]:checked').value;
    
    const filteredData = data.filter(filterPayments);
    
    let finalFilteredData = filteredData;
    if (orderStatus === "只顯示未結清訂單") {
        finalFilteredData = filteredData.filter(row => {
            const totalPaid = paymentTypes.reduce((sum, pt) => sum + row[`${pt}_amount`], 0);
            return totalPaid < row.totalCost;
        });
    } else if (orderStatus === "只顯示結清訂單") {
        finalFilteredData = filteredData.filter(row => {
            const totalPaid = paymentTypes.reduce((sum, pt) => sum + row[`${pt}_amount`], 0);
            return totalPaid === row.totalCost;
        });
    } else if (orderStatus === "只顯示有退費訂單") {
        finalFilteredData = filteredData.filter(row => row.refundtoUser_amount < 0);
    }
    
    updateTotalMetrics(finalFilteredData);
    renderOrderList(finalFilteredData);
}

function isValidPaymentDate(dateStr) {
    const paymentDate = parseDate(dateStr.split(')')[0].trim().split(' ')[0]);
    if (!paymentDate) return false;
    
    const dateType = document.querySelector('input[name="dateType"]:checked').value;
    const selectedDate = parseDate(selectedDateInput.value);
    const startDate = parseDate(startDateInput.value);
    const endDate = parseDate(endDateInput.value);
    
    if (dateType === "單日") {
        return paymentDate.getTime() === selectedDate.getTime();
    } else {
        return paymentDate >= startDate && paymentDate <= endDate;
    }
}

function filterPayments(row) {
    return paymentTypes.some(paymentType => {
        const payments = row[`${paymentType}_info`].split('\n');
        return payments.some(payment => payment && payment.includes('(') && isValidPaymentDate(payment.split('(')[1]));
    });
}

// Update total metrics
function updateTotalMetrics(data) {
    let totalCash = 0;
    let totalTransfer = 0;
    let totalCheque = 0;
    let refundCount = 0;
    let totalRefundAmount = 0;
    
    const dateType = document.querySelector('input[name="dateType"]:checked').value;
    const startDate = parseDate(dateType === "單日" ? selectedDateInput.value : startDateInput.value);
    const endDate = parseDate(dateType === "單日" ? selectedDateInput.value : endDateInput.value);
    
    data.forEach(row => {
        paymentTypes.forEach(paymentType => {
            const payments = row[`${paymentType}_info`].split('\n');
            payments.forEach(payment => {
                if (!payment) return;
                const [amountStr, dateMethodStr] = payment.split('(');
                const amount = parseAmount(amountStr);
                const [dateStr, method] = dateMethodStr.split(')')[0].split(' ');
                const paymentDate = parseDate(dateStr);
                
                if (paymentDate >= startDate && paymentDate <= endDate) {
                    if (paymentType !== 'refundtoUser') { // 排除退費金額
                        if (method.includes('現金')) totalCash += amount;
                        else if (method.includes('匯款')) totalTransfer += amount;
                        else if (method.includes('支票')) totalCheque += amount;
                    }
                    
                    if (paymentType === 'refundtoUser') {
                        refundCount++;
                        totalRefundAmount += Math.abs(amount);
                    }
                }
            });
        });
    });
    
    const totalAll = totalCash + totalTransfer + totalCheque - totalRefundAmount;
    
    document.getElementById('totalCash').textContent = `$${totalCash.toLocaleString()}`;
    document.getElementById('totalTransfer').textContent = `$${totalTransfer.toLocaleString()}`;
    document.getElementById('totalCheque').textContent = `$${totalCheque.toLocaleString()}`;
    document.getElementById('totalAmount').textContent = `$${totalAll.toLocaleString()}`;
    document.getElementById('totalRefundAmount').textContent = `${refundCount}筆 / $${totalRefundAmount.toLocaleString()} `;
    
}

// Render order list
function renderOrderList(data) {
    const table = document.createElement('table');
    table.id = 'orderTable';
    table.innerHTML = `
        <thead>
            <tr>
                <th>訂單編號</th>
                <th>客戶名稱</th>
                <th>當前餐費</th>
                <th>已支付金額</th>
                <th>訂金</th>
                <th>頭款</th>
                <th>尾款</th>
                <th>續訂尾款</th>
                <th>退費</th>
                <th>付款狀態</th>
                <th>結案狀態</th>
                <th>詳情</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;

    const tbody = table.querySelector('tbody');

    data.forEach(row => {
        const tr = document.createElement('tr');
        const totalPaid = paymentTypes.reduce((sum, pt) => sum + row[`${pt}_amount`], 0);
        const remaining = row.totalCost - totalPaid;
        let status;
        if (remaining === 0) {
            status = '<span class="status-complete">已結清</span>';
        } else if (remaining > 0) {
            status = `<span class="status-incomplete">未結清 (差額: $${remaining.toLocaleString()})</span>`;
        } else {
            status = `<span class="status-overpaid">超付 (金額: $${(-remaining).toLocaleString()})</span>`;
        }

        const caseStatus = row.isSealed ? '<span class="status-closed">已結案</span>' : '<span class="status-open">未結案</span>';

        tr.innerHTML = `
            <td>${row.fileNumber || '無編號'}</td>
            <td>${row.userName || ''}</td>
            <td>$${(row.totalCost || 0).toLocaleString()}</td>
            <td>$${totalPaid.toLocaleString()}</td>
            <td>$${(row.deposit_amount || 0).toLocaleString()}</td>
            <td>$${(row.firstPayment_amount || 0).toLocaleString()}</td>
            <td>$${(row.finalPayment_amount || 0).toLocaleString()}</td>
            <td>$${(row.renewalFinalPayment_amount || 0).toLocaleString()}</td>
            <td>$${Math.abs(row.refundtoUser_amount || 0).toLocaleString()}</td>
            <td>${status}</td>
            <td>${caseStatus}</td>
            <td><button class="details-btn" data-id="${row.id}">詳情</button></td>
        `;

        if (row.isSealed) {
            tr.classList.add('closed-case-row');
        }

        tbody.appendChild(tr);
    });

    orderList.innerHTML = '';
    orderList.appendChild(table);

    // 添加詳情按鈕的事件監聽器
    const detailButtons = document.querySelectorAll('.details-btn');
    detailButtons.forEach(button => {
        button.addEventListener('click', () => showOrderDetails(button.dataset.id));
    });
}

// 顯示訂單詳情
function showOrderDetails(orderId) {
    console.log("Showing details for order:", orderId);
    const order = firestoreData.find(item => item.id === orderId);
    if (!order) {
        console.error("Order not found:", orderId);
        return;
    }

    console.log("Full order data:", JSON.stringify(order, null, 2));
    const ourMealsBreakfast = order.ourMeals ? order.ourMeals['早餐'] || 0 : 0;
    const ourMealsLunch = order.ourMeals ? order.ourMeals['午餐'] || 0 : 0;
    const ourMealsDinner = order.ourMeals ? order.ourMeals['晚餐'] || 0 : 0;
    const hospitalMealsBreakfast = order.hospitalMeals ? order.hospitalMeals['早餐'] || 0 : 0;
    const hospitalMealsLunch = order.hospitalMeals ? order.hospitalMeals['午餐'] || 0 : 0;
    const hospitalMealsDinner = order.hospitalMeals ? order.hospitalMeals['晚餐'] || 0 : 0;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>訂單詳情</h3>
            <table class="details-table">
                <tr>
                    <th>訂單編號</th>
                    <td>${order.fileNumber || '無編號'}</td>
                    <th>客戶名稱</th>
                    <td>${order.userName}</td>
                </tr>
                <tr>
                    <th>住宅餐點 (早/午/晚)</th>
                    <td>${ourMealsBreakfast}/${ourMealsLunch}/${ourMealsDinner}</td>
                    <th>預產期</th>
                    <td>${order.dueDate === 'N/A' ? '無' : (order.dueDate || '無')}</td>
                </tr>
                <tr>
                    <th>醫院餐點 (早/午/晚)</th>
                    <td>${hospitalMealsBreakfast}/${hospitalMealsLunch}/${hospitalMealsDinner}</td>
                    <th>簽約人</th>
                    <td>${order.contractPerson || '無'}</td>

                </tr>
                <tr>
                    <th>簽約方案</th>
                    <td colspan="3">${order.note2 || '無'}</td>
                </tr>
                <tr>
                    <th>備註</th>
                    <td colspan="3">${order.note || '無'}</td>
                </tr>
                <tr>
                    <th>結案狀態</th>
                    <td colspan="3">${order.isSealed ? '<span class="status-closed">已結案</span>' : '<span class="status-open">未結案</span>'}</td>
                </tr>
            </table>
            <h3>支付詳情</h3>
            <table id="paymentDetailsTable" class="payment-table">
                <thead>
                    <tr>
                        <th>類型</th>
                        <th>金額</th>
                        <th>日期</th>
                        <th>支付方式</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
                <div class="details-layout">
        <div class="chart-container">
            <div id="orderChart" style="width: 100%; height: 300px;"></div>
        </div>
        <div class="memo-container">
            <h4>備忘錄</h4>
            <textarea id="orderMemo" rows="10" placeholder="在此輸入備忘錄..."></textarea>
            <button id="saveMemoBtn">保存備忘錄</button>
        </div>
    </div>
        </div>
    `;

    document.body.appendChild(modal);

    const paymentDetailsTable = modal.querySelector('#paymentDetailsTable tbody');
    let hasPayments = false;

    if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
        hasPayments = true;
        order.payments.forEach(payment => {
            const tr = document.createElement('tr');
            const confirmedMark = payment.confirmedWithCode ? '<span style="color: red; font-weight: bold;" title="此付款已通過確認碼驗證"> <i class="fas fa-exclamation-circle"></i> 過期入帳</span>' : '';
            tr.innerHTML = `
                <td>${paymentTypesChinese[payment.type] || payment.type}</td>
                <td>$${Math.abs(payment.amount).toLocaleString()} ${confirmedMark}</td>
                <td>${payment.timestamp.substr(0, 10)}</td>
                <td>${paymentMethodsChinese[payment.method] || payment.method}</td>
            `;
            paymentDetailsTable.appendChild(tr);
        });
    } else {
        paymentTypes.forEach(pt => {
            const paymentInfo = order[`${pt}_info`];
            const paymentAmount = order[`${pt}_amount`];
            const confirmedWithCode = order[`${pt}_confirmedWithCode`] || false;

            if (paymentAmount !== undefined && paymentAmount !== 0) {
                hasPayments = true;
                const paymentInfoParts = paymentInfo ? paymentInfo.split('(') : [];
                const datePart = paymentInfoParts[1] ? paymentInfoParts[1].split(')')[0] : '';
                const [date, method] = datePart.split(' ');
                
                const confirmedMark = confirmedWithCode ? '<span style="color: red; font-weight: bold;" title="此付款已通過確認碼驗證"> <i class="fas fa-exclamation-circle"></i> 過期入賬</span>' : '';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${paymentTypesChinese[pt]}</td>
                    <td>$${Math.abs(paymentAmount).toLocaleString()} ${confirmedMark}</td>
                    <td>${date || ''}</td>
                    <td>${method || ''}</td>
                `;
                paymentDetailsTable.appendChild(tr);
            }
        });
    }

    if (!hasPayments) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4">無支付記錄</td>';
        paymentDetailsTable.appendChild(tr);
    }

    function closeModal() {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', handleKeyDown);

    setTimeout(() => createPieChart(order, 'orderChart'), 0);
    const memoTextarea = modal.querySelector('#orderMemo');
    const saveMemoBtn = modal.querySelector('#saveMemoBtn');

    // 從 Firestore 加載備忘錄
    db.collection('calculations').doc(orderId).get()
    .then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            memoTextarea.value = data.memo || '';
            console.log("Loaded memo:", data.memo);
        } else {
            console.log("No document found with ID:", orderId);
            memoTextarea.value = '';
        }
    })
    .catch((error) => {
        console.error("Error loading memo:", error);
        alert('加載備忘錄時出錯：' + error.message);
    });

    // 保存備忘錄到 Firestore
    saveMemoBtn.addEventListener('click', () => {
        const memoText = memoTextarea.value;
        console.log("Attempting to save memo for document:", orderId);
    
        const docRef = db.collection('calculations').doc(orderId);
    
        docRef.set({
            memo: memoText
        }, { merge: true })  // 使用 merge 選項以確保只更新 memo 字段
        .then(() => {
            console.log('Memo saved successfully');
            alert('備忘錄已保存');
            
            // 立即讀取以驗證保存
            return docRef.get();
        })
        .then((doc) => {
            if (doc.exists) {
                console.log("Verified saved memo:", doc.data().memo);
            } else {
                console.error("Document does not exist after saving");
            }
        })
        .catch((error) => {
            console.error("Error saving or verifying memo:", error);
            alert('保存或驗證備忘錄時出錯：' + error.message);
        });

    });

}


// Toggle order content visibility
function toggleOrderContent(expanderDiv) {
    expanderDiv.classList.toggle('active');
    const contentDiv = expanderDiv.querySelector('.order-content');
    contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
}
// Create pie chart using Plotly
function createPieChart(row, chartId) {
    let paymentData = [];
    let totalPaid = 0;

    // 檢查是否有 payments 數組
    if (row.payments && Array.isArray(row.payments) && row.payments.length > 0) {
        const paymentSums = row.payments.reduce((acc, payment) => {
            const type = paymentTypesChinese[payment.type] || payment.type;
            if (payment.type !== 'refundtoUser') {
                acc[type] = (acc[type] || 0) + payment.amount;
                totalPaid += payment.amount;
            } else {
                // 對於退款，我們減少總支付額
                totalPaid -= Math.abs(payment.amount);
            }
            return acc;
        }, {});

        paymentData = Object.entries(paymentSums).map(([type, amount]) => ({ type, amount }));
    } else {
        // 使用舊格式的數據
        paymentData = paymentTypes.map(pt => ({
            type: paymentTypesChinese[pt],
            amount: row[`${pt}_amount`] || 0
        }));
        totalPaid = paymentTypes.reduce((sum, pt) => {
            const amount = row[`${pt}_amount`] || 0;
            return pt !== 'refundtoUser' ? sum + amount : sum - Math.abs(amount);
        }, 0);
    }

    const remaining = Math.max(0, row.totalCost - totalPaid);
    
    if (remaining > 0) {
        paymentData.push({ type: '未支付', amount: remaining });
    }
    
    const filteredData = paymentData.filter(item => item.amount > 0);
    
    if (filteredData.length === 0) {
        document.getElementById(chartId).innerHTML = '沒有支付記錄，無法生成圖表。';
        return;
    }
    
    const data = [{
        values: filteredData.map(item => item.amount),
        labels: filteredData.map(item => item.type),
        type: 'pie',
        marker: {
            colors: filteredData.map(item => typeColors[item.type] || '#999')
        }
    }];
    
    const layout = {
        height: 300,
        width: 400,  // 調整寬度以適應新的佈局
        margin: { l: 0, r: 0, t: 40, b: 0 },
        title: {
            text: '支付比例',
            font: { size: 16 },
            y: 0.99,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top'
        },
        showlegend: true
    };
    
    Plotly.newPlot(chartId, data, layout);
}



// Reload data
function reloadData() {
    firestoreData = [];
    fetchFirestoreData();
}

// 初始化日期選擇器
function initDatePickers() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    selectedDateInput.value = formatDate(yesterday);
    endDateInput.value = formatDate(yesterday);
    
    const thirtyDaysAgo = new Date(yesterday);
    thirtyDaysAgo.setDate(yesterday.getDate() - 30);
    startDateInput.value = formatDate(thirtyDaysAgo);
}

// 輔助函數：將日期格式化為 YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function checkForConfirmedPayments() {
    const confirmedPayments = [];
    try {
        const snapshot = await db.collection('calculations').get();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.payments && Array.isArray(data.payments)) {
                data.payments.forEach((payment, index) => {
                    if (payment.confirmedWithCode === true && !payment.notificationShown) {
                        confirmedPayments.push({
                            id: doc.id,
                            paymentIndex: index, // 添加付款在數組中的索引
                            userName: data.userName,
                            fileNumber: data.fileNumber,
                            paymentDate: payment.timestamp,
                            paymentAmount: payment.amount,
                            paymentMethod: payment.method,
                            paymentType: payment.type,
                            mealType: payment.mealType,
                            accountNumber: payment.accountNumber
                        });
                    }
                });
            }
        });
    } catch (error) {
        console.error("Error checking for confirmed payments:", error);
    }
    return confirmedPayments;
}

function showNotification(payment) {
    const modal = document.createElement('div');
    modal.className = 'modal notification-modal';
    
    // 格式化日期
    const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
    const formattedDate = paymentDate 
        ? `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(paymentDate.getDate()).padStart(2, '0')}`
        : '未知';

    // 格式化金額
    const formattedAmount = payment.paymentAmount ? `$${payment.paymentAmount.toLocaleString()}` : '未知';

    // 轉換支付方式為中文
    const paymentMethodChinese = {
        'cash': '現金',
        'transfer': '匯款',
        'cheque': '支票'
    };
    const formattedMethod = paymentMethodChinese[payment.paymentMethod] || payment.paymentMethod || '未知';

    // 轉換支付類型為中文
    const paymentTypeChinese = {
        'deposit': '訂金',
        'firstPayment': '頭款',
        'finalPayment': '尾款',
        'renewalFinalPayment': '續訂尾款',
        'refundtoUser': '退費'
    };
    const formattedType = paymentTypeChinese[payment.paymentType] || payment.paymentType || '未知';

    modal.innerHTML = `
        <div class="modal-content notification-content">
            <h3 class="notification-title">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;過期結帳通知 <i class="fas fa-bell"></i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</h3>
            <div class="notification-details">
                <table class="details-table">
                    <tr>
                        <th>檔案編號</th>
                        <td>${payment.fileNumber || '無編號'}</td>
                    </tr>
                    <tr>
                        <th>客戶名稱</th>
                        <td>${payment.userName || '未知'}</td>
                    </tr>
                    <tr>
                        <th>支付日期</th>
                        <td>${formattedDate}</td>
                    </tr>
                    <tr>
                        <th>支付金額</th>
                        <td>${formattedAmount}</td>
                    </tr>
                    <tr>
                        <th>支付方式</th>
                        <td>${formattedMethod}</td>
                    </tr>
                    <tr>
                        <th>支付類型</th>
                        <td>${formattedType}</td>
                    </tr>
                    ${payment.mealType ? `
                    <tr>
                        <th>餐點類型</th>
                        <td>${payment.mealType}</td>
                    </tr>
                    ` : ''}
                    ${payment.accountNumber ? `
                    <tr>
                        <th>帳號</th>
                        <td>${payment.accountNumber}</td>
                    </tr>
                    ` : ''}
                </table>

            <div class="notification-actions">
                <button id="confirmBtn" class="btn btn-primary" data-doc-id="${payment.id}" data-payment-index="${payment.paymentIndex}">
                    <i class="fas fa-check"></i> 收到
                </button>
                <button id="cancelBtn" class="btn btn-secondary">
                    <i class="fas fa-times"></i> 稍後提醒
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('#confirmBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (event) => {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
            try {
                const docId = event.target.getAttribute('data-doc-id');
                const paymentIndex = parseInt(event.target.getAttribute('data-payment-index'), 10);
                await markNotificationAsShown(docId, paymentIndex);
                document.body.removeChild(modal);
            } catch (error) {
                console.error('Error marking notification as shown:', error);
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> 收到並標記為已處理';
                alert('處理過程中出錯，請稍後再試。');
            }
        });
    } else {
        console.error('Confirm button not found');
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    } else {
        console.error('Cancel button not found');
    }
}
async function markNotificationAsShown(docId, paymentIndex) {
    try {
        const docRef = db.collection('calculations').doc(docId);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data.payments && Array.isArray(data.payments) && paymentIndex >= 0 && paymentIndex < data.payments.length) {
                const updatedPayments = [...data.payments];
                updatedPayments[paymentIndex] = {
                    ...updatedPayments[paymentIndex],
                    notificationShown: true
                };
                await docRef.update({ payments: updatedPayments });
                console.log('Notification marked as shown successfully for payment index:', paymentIndex);
            } else {
                console.error('Invalid payment index or no payments array found in the document');
            }
        } else {
            console.error('Document not found');
        }
    } catch (error) {
        console.error("Error marking notification as shown:", error);
        throw error;
    }
}

const correctPassword = "1218"; // Replace with your actual password
const passwordModal = document.getElementById('passwordModal');
const passwordInput = document.getElementById('passwordInput');
const submitPassword = document.getElementById('submitPassword');

function showPasswordModal() {
    passwordModal.style.display = 'block';
}

function hidePasswordModal() {
    passwordModal.style.display = 'none';
}

function validatePassword() {
    if (passwordInput.value === correctPassword) {
        hidePasswordModal();
        init(); // Initialize the main application
    } else {
        alert('密碼錯誤，請重試。');
        passwordInput.value = '';
    }
}

submitPassword.addEventListener('click', validatePassword);
passwordInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        validatePassword();
    }
});


window.addEventListener('load', showPasswordModal);

async function init() {
    initDatePickers();
    await fetchFirestoreData();
    
    // 只在應用首次加載時檢查確認的付款
    if (!window.confirmedPaymentsChecked) {
        const confirmedPayments = await checkForConfirmedPayments();
        if (confirmedPayments.length > 0) {
            confirmedPayments.forEach(payment => {
                showNotification(payment);
            });
        }
        window.confirmedPaymentsChecked = true;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const pageSelection = document.getElementById('pageSelection');
    
    pageSelection.addEventListener('change', function(event) {
        if (event.target.value === '業績狀況') {
            // Navigate to the performance status page
            window.location.href = 'performance-status.html';
        } else if (event.target.value === '訂單總覽') {
            // Stay on the current page or reload if necessary
            window.location.href = 'index.html';
        }
    });
});

// 確保只在頁面加載時調用一次 init  
window.addEventListener('load', () => {
    if (!window.initCalled) {
        showPasswordModal();
        window.initCalled = true;
    }
});


// Start the application
init();