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


// Fetch data from Firestore
async function fetchFirestoreData() {
    try {
        const snapshot = await db.collection('calculations').get();
        firestoreData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // 處理數據並更新 UI
        processData();

        // 重置搜索輸入框
        const customerNameInput = document.getElementById('customerNameInput');
        if (customerNameInput) {
            customerNameInput.value = '';
        }

        // 檢查確認的付款
        if (!window.confirmedPaymentsChecked) {
            const confirmedPayments = await checkForConfirmedPayments();
            if (confirmedPayments.length > 0) {
                confirmedPayments.forEach(payment => {
                    showNotification(payment);
                });
            }
            window.confirmedPaymentsChecked = true;
        }
    } catch (error) {
        console.error("Error fetching Firestore data:", error);
        const orderList = document.getElementById('orderList');
        if (orderList) {
            orderList.innerHTML = '<p class="error">Error fetching data. Please try again later.</p>';
        }
    }
}

// 添加輸入框的 Enter 鍵事件監聽器
customerNameInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
});

// 執行搜索的函數
async function performSearch() {
    const searchTerm = customerNameInput.value.trim().toLowerCase();

    if (searchTerm === '') {
        // 如果搜索框為空，恢復顯示所有數據
        fetchFirestoreData();
    } else {
        try {
            // 從 Firestore 查詢所有匹配的客戶名稱
            const querySnapshot = await db.collection('calculations')
                .where('userName', '>=', searchTerm)
                .where('userName', '<=', searchTerm + '\uf8ff')
                .get();

            const filteredData = [];
            querySnapshot.forEach((doc) => {
                filteredData.push({ id: doc.id, ...doc.data() });
            });

            // 使用過濾後的數據更新 UI
            if (filteredData.length > 0) {
                updateUI(filteredData);
            } else {
                alert('找不到相關客戶');
            }
        } catch (error) {
            console.error("Error searching for customers:", error);
        }
    }
}
customerNameInput.addEventListener('input', () => {
    const searchTerm = customerNameInput.value.trim();

    if (searchTerm === '') {
        // 如果搜索框被清空，重新加載所有數據
        fetchFirestoreData();
    }
});



// Process and flatten the data
function processData() {
    const customerNameInput = document.getElementById('customerNameInput');
    const searchTerm = customerNameInput ? customerNameInput.value.trim().toLowerCase() : '';
    let dataToProcess = firestoreData;
    
    if (searchTerm !== '') {
        dataToProcess = firestoreData.filter(item => 
            item.userName && item.userName.toLowerCase().includes(searchTerm)
        );
    }

    const flatData = dataToProcess.map(item => {
        const flatItem = {...item, ...item.hospitalMeals, ...item.ourMeals};
        
        paymentTypes.forEach(paymentType => {
            flatItem[`${paymentType}_amount`] = 0;
            flatItem[`${paymentType}_info`] = '';
        });
        
        const payments = item.payments || [];
        const filteredPayments = payments.filter(p => p.method !== 'pending');
        
        filteredPayments.forEach(payment => {
            if (paymentTypes.includes(payment.type)) {
                if (payment.type !== 'refundtoUser') {
                    flatItem[`${payment.type}_amount`] += payment.amount;
                }
                const timestamp = payment.timestamp.substr(0, 10);
                const methodChinese = paymentMethodsChinese[payment.method] || payment.method;
                const info = `$ ${payment.amount.toLocaleString()} (${timestamp} ${methodChinese})`;
                flatItem[`${payment.type}_info`] += `${info}\n`;
            }
        });
        
        const refunds = payments.filter(p => p.type === 'refundtoUser');
        flatItem['refundtoUser_amount'] = refunds.reduce((sum, r) => sum + r.amount, 0);
        flatItem['refundtoUser_info'] = refunds.map(r => `$ ${Math.abs(r.amount).toLocaleString()} (${r.timestamp.substr(0, 10)} ${paymentMethodsChinese[r.method] || r.method})`).join('\n');
        flatItem.memo = item.memo || '';
        return flatItem;
    });
    
    updateUI(flatData);
}

document.addEventListener('DOMContentLoaded', () => {
    const customerNameInput = document.getElementById('customerNameInput');
    const searchButton = document.getElementById('searchButton');

    if (customerNameInput && searchButton) {
        searchButton.addEventListener('click', () => {
            processData();
        });

        customerNameInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                processData();
            }
        });
    }
});

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
    const searchTerm = customerNameInput.value.trim().toLowerCase();
    
    // 如果搜索框有客戶名稱的搜索，則忽略日期篩選，只要匹配客戶就顯示
    if (searchTerm !== '' && row.userName && row.userName.toLowerCase().includes(searchTerm)) {
        return true;
    }

    // 如果沒有搜索客戶名稱，則進行日期篩選
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
                <th>檔案編號</th>
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
                    <th>檔案編號</th>
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
            let methodDisplay = paymentMethodsChinese[payment.method] || payment.method;
            if (payment.method === 'transfer' && payment.accountNumber) {
                methodDisplay += `: ${payment.accountNumber}`;
            }
            tr.innerHTML = `
                <td>${paymentTypesChinese[payment.type] || payment.type}</td>
                <td>$${Math.abs(payment.amount).toLocaleString()} ${confirmedMark}</td>
                <td>${payment.timestamp.substr(0, 10)}</td>
                <td>${methodDisplay}</td>
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
                
                let methodDisplay = method || '';
                if (method === '匯款' && order[`${pt}_accountNumber`]) {
                    methodDisplay += `: ${order[`${pt}_accountNumber`]}`;
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${paymentTypesChinese[pt]}</td>
                    <td>$${Math.abs(paymentAmount).toLocaleString()} ${confirmedMark}</td>
                    <td>${date || ''}</td>
                    <td>${methodDisplay}</td>
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
                    if (payment.confirmedWithCode === true && 
                        !payment.notificationShown && 
                        payment.method !== 'pending') {  // 新增條件：排除未付款
                        confirmedPayments.push({
                            id: doc.id,
                            paymentIndex: index,
                            userName: data.userName,
                            fileNumber: data.fileNumber,
                            cabinetNumberResidential: data.cabinetNumberResidential,
                            cabinetNumberHospital: data.cabinetNumberHospital,
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
        'cheque': '支票',
        'pending': '未付款'
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

let isDetailedView = false;
const toggleViewBtn = document.getElementById('toggleViewBtn');

function toggleView() {
    isDetailedView = !isDetailedView;
    if (isDetailedView) {
        updateDailySummary();
    } else {
        enableOrderStatusFilters();
        updateData();
    }
    toggleViewBtn.textContent = isDetailedView ? "切換為總覽顯示" : "切換為結帳檢視";
}

toggleViewBtn.addEventListener('click', toggleView);

function updateDatePickers() {
    const dateType = document.querySelector('input[name="dateType"]:checked').value;
    if (dateType === '單日') {
        selectedDateInput.style.display = 'block';
        startDateInput.style.display = 'none';
        endDateInput.style.display = 'none';
        toggleViewBtn.style.display = 'inline-block';
    } else {
        selectedDateInput.style.display = 'none';
        startDateInput.style.display = 'block';
        endDateInput.style.display = 'block';
        toggleViewBtn.style.display = 'none';
        enableOrderStatusFilters(); // 確保在日期範圍模式下啟用篩選
    }
    updateData();
}

async function updateData() {
    if (firestoreData.length > 0) {
        const dateType = document.querySelector('input[name="dateType"]:checked').value;
        if (dateType === '單日' && isDetailedView) {
            await updateDailySummary();
        } else {
            processData();
        }
    } else {
        fetchFirestoreData();
    }
}

async function updateDailySummary() {
    disableOrderStatusFilters();
    const selectedDate = document.getElementById('selectedDate').value;
    if (!selectedDate) {
        alert('請選擇日期');
        return;
    }

    const orderList = document.getElementById('orderList');
    orderList.innerHTML = '載入中...';

    try {
        const date = new Date(selectedDate);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(startOfDay.getDate() + 1);

        // 查詢所有訂單
        const querySnapshot = await db.collection("calculations").get();
        const pettyCashQuerySnapshot = await db.collection('pettyCash').where('date', '==', selectedDate).get();

        let cashTotal = 0;
        let transferTotal = 0;
        let chequeTotal = 0;
        let refundTotal = 0;
        let pettyCashTotal = 0;

        // 存儲付款明細
        let paymentDetails = [];

        // 付款類型對應中文
        const paymentTypesChinese = {
            'deposit': '訂金',
            'firstPayment': '頭款',
            'finalPayment': '尾款',
            'renewalFinalPayment': '續訂尾款',
            'refundtoUser': '退費'
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const payments = data.payments || [];
            const fileNumber = data.fileNumber || '';
            const cabinetNumberResidential = data.cabinetNumberResidential || '';
            const cabinetNumberHospital = data.cabinetNumberHospital || '';
            const userName = data.userName || '未知';
            const note2 = data.note2 || '';
            const uniqueId = doc.id;

            payments.forEach((payment) => {
                const paymentDate = payment.timestamp instanceof firebase.firestore.Timestamp
                    ? payment.timestamp.toDate()
                    : new Date(payment.timestamp);

                if (paymentDate >= startOfDay && paymentDate < endOfDay) {
                    if (payment.method === 'pending') {
                        return;
                    }

                    paymentDetails.push({
                        uniqueId,
                        fileNumber,
                        cabinetNumberResidential,
                        cabinetNumberHospital,
                        userName,
                        type: payment.type,
                        method: payment.method,
                        amount: payment.amount,
                        note: payment.type === 'deposit' ? note2 : '',
                        accountNumber: payment.accountNumber || '未知',
                        confirmedWithCode: payment.confirmedWithCode || false
                    });

                    if (payment.type === 'refundtoUser') {
                        refundTotal += payment.amount;
                    } else {
                        if (payment.method === 'cash') {
                            cashTotal += payment.amount;
                        } else if (payment.method === 'transfer') {
                            transferTotal += payment.amount;
                        } else if (payment.method === 'cheque') {
                            chequeTotal += payment.amount;
                        }
                    }
                }
            });
        });

        // 計算當天的零用金
        pettyCashQuerySnapshot.forEach((doc) => {
            const data = doc.data();
            pettyCashTotal += data.amount;
        });

        // 排序付款明細
        paymentDetails.sort((a, b) => {
            // 首先按照付款方式排序：現金 > 匯款 > 其他
            const methodOrder = { 'cash': 0, 'transfer': 1 };
            const methodDiff = (methodOrder[a.method] || 2) - (methodOrder[b.method] || 2);
            if (methodDiff !== 0) return methodDiff;

            // 然後按照付款類型排序：訂金 > 退費 > 其他
            const typeOrder = { 'deposit': 0, 'refundtoUser': 1 };
            return (typeOrder[a.type] || 2) - (typeOrder[b.type] || 2);
        });

        // 生成訂單表格
        let orderTableHtml = `
            <table id="orderTable">
                <thead>
                    <tr>
                        <th>檔案編號</th>
                        <th>客戶名稱</th>
                        <th>付款類型</th>
                        <th>付款方式</th>
                        <th>金額</th>
                        <th>詳情</th>
                    </tr>
                </thead>
                <tbody>
        `;

        paymentDetails.forEach((detail, index) => {
            const paymentType = paymentTypesChinese[detail.type] || detail.type;
            let paymentMethod = '';
            if (detail.method === 'cash') {
                paymentMethod = '現金';
            } else if (detail.method === 'transfer') {
                paymentMethod = `匯款 : ${detail.accountNumber}`;
            } else if (detail.method === 'cheque') {
                paymentMethod = '支票';
            } else {
                paymentMethod = detail.method;
            }
            
            let statusClass = '';
            if (detail.type === 'refundtoUser') {
                statusClass = 'status-refundtoUser';
            } else if (detail.type === 'deposit') {
                statusClass = 'status-deposit';
            }

            let amountDisplay = `$${Math.abs(detail.amount).toLocaleString()}`;
            if (detail.confirmedWithCode) {
                amountDisplay += ' <i class="fas fa-exclamation-circle" style="color: #FF9800;" title="過期入帳"></i>';
            }

            orderTableHtml += `
                <tr class="${statusClass}">
                    <td>${detail.fileNumber}</td>
                    <td>${detail.userName}</td>
                    <td>${paymentType}</td>
                    <td>${paymentMethod}</td>
                    <td>${amountDisplay}</td>
                    <td><button class="details-btn" onclick="showOrderDetails('${detail.uniqueId}')">詳情</button></td>
                </tr>
            `;
        });

        orderTableHtml += `
                </tbody>
            </table>
            <button id="exportToExcel" class="btn btn-success">
                <i class="fas fa-file-excel"></i> 輸出excel
            </button>
        `;

        // 更新總計顯示
        document.getElementById('totalCash').textContent = `$${cashTotal.toLocaleString()}`;
        document.getElementById('totalTransfer').textContent = `$${transferTotal.toLocaleString()}`;
        document.getElementById('totalCheque').textContent = `$${chequeTotal.toLocaleString()}`;
        document.getElementById('totalRefundAmount').textContent = `${paymentDetails.filter(d => d.type === 'refundtoUser').length}筆 / $${Math.abs(refundTotal).toLocaleString()}`;
        document.getElementById('totalAmount').textContent = `$${(cashTotal + transferTotal + chequeTotal - Math.abs(refundTotal) + pettyCashTotal).toLocaleString()}`;

        // 顯示訂單表格
        orderList.innerHTML = orderTableHtml;

    } catch (error) {
        console.error("Error updating daily summary:", error);
        orderList.innerHTML = '<p class="error">更新數據時出錯。請稍後再試。</p>';
    }
    // 在 updateDailySummary 函數的末尾添加
    document.getElementById('exportToExcel').style.display = 'inline-block';
}

function disableOrderStatusFilters() {
    const orderStatusRadios = document.querySelectorAll('input[name="orderStatus"]');
    orderStatusRadios.forEach(radio => {
        radio.disabled = true;
        radio.parentElement.classList.add('disabled');
    });
    const orderStatusSelection = document.getElementById('orderStatusSelection');
    orderStatusSelection.classList.add('locked');
    
    // 更新鎖定狀態顯示
    const filterLockStatus = document.getElementById('filterLockStatus');
    filterLockStatus.innerHTML = '<i class="fas fa-lock" title="在每日總結視圖中不可用"></i>';
}

function enableOrderStatusFilters() {
    const orderStatusRadios = document.querySelectorAll('input[name="orderStatus"]');
    orderStatusRadios.forEach(radio => {
        radio.disabled = false;
        radio.parentElement.classList.remove('disabled');
    });
    const orderStatusSelection = document.getElementById('orderStatusSelection');
    orderStatusSelection.classList.remove('locked');
    
    // 清除鎖定狀態顯示
    const filterLockStatus = document.getElementById('filterLockStatus');
    filterLockStatus.innerHTML = '';
}


// 使用事件委託來處理導出按鈕的點擊
document.addEventListener('click', function(event) {
    if (event.target && event.target.id === 'exportToExcel') {
        exportToExcel();
    }
});

async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Summary');

    const selectedDate = document.getElementById('selectedDate').value;

    const headerData = [
        ['日期', selectedDate],
        ['現金總額', document.getElementById('totalCash').textContent],
        ['匯款總額', document.getElementById('totalTransfer').textContent],
        ['支票總額', document.getElementById('totalCheque').textContent],
        ['退費總額', document.getElementById('totalRefundAmount').textContent],
        ['總收入', document.getElementById('totalAmount').textContent],
        [],
        ['訂單詳情'],
        ['檔案編號', '客戶名稱', '付款類型', '付款方式', '金額']
    ];

    worksheet.addRows(headerData);

    const orderTable = document.getElementById('orderTable');
    if (orderTable) {
        const rows = orderTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            worksheet.addRow([
                cells[0].textContent,
                cells[1].textContent,
                cells[2].textContent,
                cells[3].textContent,
                cells[4].textContent
            ]);
        });
    }

    worksheet.columns = [
        { width: 17 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 17 }
    ];

    const borderStyle = {
        top: {style:'thin'},
        left: {style:'thin'},
        bottom: {style:'thin'},
        right: {style:'thin'}
    };

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            
            // 為前六行設置更大的字體
            if (rowNumber <= 6) {
                cell.font = { size: 16 };
            }
            // 對第8行和第9行使用粗體，字體大小為12
            else if (rowNumber === 8 || rowNumber === 9) {
                cell.font = { bold: true, size: 14 };
            }
            // 其他所有行使用12號字體
            else {
                cell.font = { size: 14 };
            }

            // 為第9行（標題行）添加灰色背景和框線
            if (rowNumber === 9) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' }  // 淺灰色
                };
                cell.border = borderStyle;
            }
        });
    });

    worksheet.mergeCells('A8:E8');

    // 為所有數據行添加框線
    const dataRowStart = 10;  // 數據從第10行開始
    const lastRow = worksheet.lastRow.number;
    for (let i = dataRowStart; i <= lastRow; i++) {
        worksheet.getRow(i).eachCell(cell => {
            cell.border = borderStyle;
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `每日結帳_${selectedDate}.xlsx`;
    link.click();
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