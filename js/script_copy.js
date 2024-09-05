
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
        firestoreData = snapshot.docs.map(doc => doc.data());
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
                flatItem[`${payment.type}_amount`] += payment.amount;
                const timestamp = payment.timestamp.substr(0, 10);
                const methodChinese = paymentMethodsChinese[payment.method] || payment.method;
                const info = `$ ${payment.amount.toLocaleString()} (${timestamp} ${methodChinese})`;
                flatItem[`${payment.type}_info`] += `${info}\n`;
            }
        });
        
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
                    if (method.includes('現金')) totalCash += amount;
                    else if (method.includes('匯款')) totalTransfer += amount;
                    else if (method.includes('支票')) totalCheque += amount;
                    
                    if (paymentType === 'refundtoUser') {
                        refundCount++;
                        totalRefundAmount += Math.abs(amount);
                    }
                }
            });
        });
    });
    
    const totalAll = totalCash + totalTransfer + totalCheque;
    
    document.getElementById('totalCash').textContent = `$${totalCash.toLocaleString()}`;
    document.getElementById('totalTransfer').textContent = `$${totalTransfer.toLocaleString()}`;
    document.getElementById('totalCheque').textContent = `$${totalCheque.toLocaleString()}`;
    document.getElementById('totalAmount').textContent = `$${totalAll.toLocaleString()}`;
    
    const totalAmountTitle = document.getElementById('totalAmountTitle');
    if (refundCount > 0) {
        totalAmountTitle.textContent = `💰 總金額 (退費: ${refundCount}筆, 共 $${totalRefundAmount.toLocaleString()})`;
    } else {
        totalAmountTitle.textContent = '💰 總金額';
    }
}

// Render order list
function renderOrderList(data) {
    orderList.innerHTML = '';
    
    if (data.length === 0) {
        const dateType = document.querySelector('input[name="dateType"]:checked').value;
        const warningMessage = dateType === '單日'
            ? `⚠️ ${selectedDateInput.value} 沒有符合條件的訂單資料。`
            : `⚠️ ${startDateInput.value} 到 ${endDateInput.value} 期間沒有符合條件的訂單資料。`;
        orderList.innerHTML = `<p class="warning">${warningMessage}</p>`;
        return;
    }
    
    data.forEach(row => {
        const orderIdentifier = row.fileNumber ? `${row.fileNumber} - ${row.userName}` : row.userName;
        const expanderDiv = document.createElement('div');
        expanderDiv.className = 'order-expander';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'order-header';
        headerDiv.textContent = `${orderIdentifier} - 總費用: $${row.totalCost.toLocaleString()}`;
        headerDiv.addEventListener('click', () => toggleOrderContent(expanderDiv));
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'order-content';
        
        // Order details
        const detailsDiv = document.createElement('div');
        if (row.isSealed) {
            detailsDiv.innerHTML += '<p class="sealed-status"><span class="sealed-icon">🎉</span>此訂單已結案</p>';
        }
        
        if (row.contractPerson && row.contractPerson !== 'nan' && row.contractPerson.trim() !== '') {
            detailsDiv.innerHTML += `<p>簽約人: ${row.contractPerson}</p>`;
        }
        
        if (row.dueDate && row.dueDate !== 'N/A') {
            detailsDiv.innerHTML += `<p>預產期: ${row.dueDate}</p>`;
        } else {
            detailsDiv.innerHTML += '<p>預產期: 無</p>';
        }
        
        // Payment information
        let hasPaymentInfo = false;
        paymentTypes.forEach(paymentType => {
            const paymentsInfo = row[`${paymentType}_info`].trim();
            if (paymentsInfo) {
                hasPaymentInfo = true;
                detailsDiv.innerHTML += `<p>${paymentTypesChinese[paymentType]}資訊:</p>`;
                paymentsInfo.split('\n').forEach(info => {
                    detailsDiv.innerHTML += `<p>- ${info}</p>`;
                });
            }
        });
        
        if (!hasPaymentInfo) {
            detailsDiv.innerHTML += '<p>沒有支付記錄。</p>';
        }
        
        // Total paid and remaining amount
        const totalPaid = paymentTypes.reduce((sum, pt) => sum + row[`${pt}_amount`], 0);
        const remaining = row.totalCost - totalPaid;
        
        detailsDiv.innerHTML += `<p>總支付金額: $${totalPaid.toLocaleString()}</p>`;
        
        if (row.note !== 'nan' && row.note.trim() !== '') {
            detailsDiv.innerHTML += `<p>備註: ${row.note}</p>`;
        }
        
        if (remaining === 0) {
            detailsDiv.innerHTML += `<p class="success">✅ 已結清: 總支付金額 $${totalPaid.toLocaleString()}</p>`;
        } else if (remaining > 0) {
            detailsDiv.innerHTML += `<p class="warning">⚠️ 未結清: 還差 $${remaining.toLocaleString()}</p>`;
        } else {
            detailsDiv.innerHTML += `<p class="error">❗ 超付: 多付了 $${(-remaining).toLocaleString()}</p>`;
        }
        
        // Pie chart
        const chartDiv = document.createElement('div');
        chartDiv.id = `chart-${row.fileNumber || row.userName}`;
        chartDiv.style.width = '100%';
        chartDiv.style.height = '300px';
        
        contentDiv.appendChild(detailsDiv);
        contentDiv.appendChild(chartDiv);
        
        expanderDiv.appendChild(headerDiv);
        expanderDiv.appendChild(contentDiv);
        orderList.appendChild(expanderDiv);
        
        // Create pie chart
        createPieChart(row, chartDiv.id);
    });
}

// Toggle order content visibility
function toggleOrderContent(expanderDiv) {
    const contentDiv = expanderDiv.querySelector('.order-content');
    contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
}

// Create pie chart using Plotly
function createPieChart(row, chartId) {
    const paymentData = paymentTypes.map(pt => ({
        type: paymentTypesChinese[pt],
        amount: row[`${pt}_amount`]
    }));
    
    const totalPaid = paymentTypes.reduce((sum, pt) => sum + row[`${pt}_amount`], 0);
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
            colors: filteredData.map(item => typeColors[item.type])
        }
    }];
    
    const layout = {
        height: 300,
        margin: { l: 0, r: 0, t: 40, b: 0 },
        title: {
            text: '支付比例',
            font: { size: 16 },
            y: 0.99,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top'
        },
        showlegend: false
    };
    
    Plotly.newPlot(chartId, data, layout);
}

// Reload data
function reloadData() {
    firestoreData = [];
    fetchFirestoreData();
}

// Initialize the application
function init() {
    initDatePickers();
    fetchFirestoreData();
}

// Start the application
init();