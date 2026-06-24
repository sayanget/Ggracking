const elements = {
    proxyUrlInput: document.getElementById('proxy-url'),
    tokenInput: document.getElementById('token'),
    saveConfigBtn: document.getElementById('save-config'),
    orderNosInput: document.getElementById('order-nos'),
    queryTypeSelect: document.getElementById('query-type'),
    searchBtn: document.getElementById('search-btn'),
    exportBtn: document.getElementById('export-btn'),
    tableWrapper: document.getElementById('table-wrapper'),
    resultsTbody: document.getElementById('results-tbody'),
    emptyState: document.getElementById('empty-state'),
    themeToggleBtn: document.getElementById('theme-toggle'),
    locFilterInput: document.getElementById('loc-filter'),
};

let currentResultsData = [];

function getApiBase() {
    const proxyUrl = elements.proxyUrlInput ? elements.proxyUrlInput.value.trim() : '';
    return proxyUrl ? proxyUrl.replace(/\/+$/, '') : '';
}

// Init
async function init() {
    const savedTheme = localStorage.getItem('gtracking-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('gtracking-theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }
    
    const localProxyUrl = localStorage.getItem('gtracking-proxy-url');
    const localToken = localStorage.getItem('gtracking-token');
    
    if (localProxyUrl && elements.proxyUrlInput) elements.proxyUrlInput.value = localProxyUrl;
    if (localToken && elements.tokenInput) elements.tokenInput.value = localToken;

    try {
        const res = await fetch(getApiBase() + '/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data.token && elements.tokenInput) {
                elements.tokenInput.value = data.token;
                localStorage.setItem('gtracking-token', data.token);
            }
        }
    } catch (e) {
        console.warn('Backend config fetch failed', e);
    }

    if (elements.saveConfigBtn) {
        elements.saveConfigBtn.addEventListener('click', async () => {
            const proxyUrl = elements.proxyUrlInput.value.trim();
            const token = elements.tokenInput.value.trim();
            localStorage.setItem('gtracking-proxy-url', proxyUrl);
            localStorage.setItem('gtracking-token', token);
            
            try {
                const res = await fetch(getApiBase() + '/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, cookie: localStorage.getItem('gtracking-cookie') || '' })
                });
                if (res.ok) alert('配置已同步保存到服务器！');
                else alert('配置已成功保存至本地浏览器');
            } catch (e) {
                alert('配置已成功保存至本地浏览器');
            }
        });
    }

    if (elements.searchBtn) elements.searchBtn.addEventListener('click', handleSearch);
    if (elements.exportBtn) elements.exportBtn.addEventListener('click', handleExport);
}

function updateThemeIcon(theme) {
    const iconSpan = elements.themeToggleBtn ? elements.themeToggleBtn.querySelector('.theme-icon') : null;
    if (iconSpan) {
        iconSpan.textContent = theme === 'light' ? '☀️' : '🌙';
    }
}

function setLoading(loading) {
    elements.searchBtn.disabled = loading;
    const btnText = elements.searchBtn.querySelector('.btn-text');
    const loader = elements.searchBtn.querySelector('.loader');
    if (loading) {
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function handleSearch() {
    const rawVal = elements.orderNosInput.value;
    const orderNos = rawVal.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    
    if (orderNos.length === 0) {
        alert('请输入单号');
        return;
    }

    setLoading(true);
    elements.tableWrapper.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.exportBtn.classList.add('hidden');
    elements.resultsTbody.innerHTML = '';
    currentResultsData = [];

    try {
        const queryType = elements.queryTypeSelect.value || '1';
        let combinedData = [];
        const BATCH_SIZE = 50;

        for (let i = 0; i < orderNos.length; i += BATCH_SIZE) {
            const batchNos = orderNos.slice(i, i + BATCH_SIZE);
            const res = await fetch(getApiBase() + '/api/tracking', {
                method: 'POST',
                body: JSON.stringify({
                    orderNos: batchNos,
                    queryType: queryType,
                    delStatus: "0"
                })
            });

            const data = await res.json();
            if (data.code === 200 && data.data) {
                combinedData = combinedData.concat(data.data);
            } else {
                console.error("Batch query failed or empty:", data);
            }
        }
        
        if (combinedData.length > 0) {
            processAndRenderResults(combinedData, orderNos);
        } else {
            alert('查询失败，接口无有效返回');
            elements.emptyState.classList.remove('hidden');
        }
    } catch (e) {
        alert('查询请求失败: ' + e.message);
        elements.emptyState.classList.remove('hidden');
    } finally {
        setLoading(false);
    }
}

function processAndRenderResults(apiData, requestedNos) {
    currentResultsData = [];
    const locFilter = elements.locFilterInput ? elements.locFilterInput.value.trim().toUpperCase() : '';
    
    // Create a map for quick lookup
    const foundDataMap = new Map();
    apiData.forEach(item => {
        const waybillNo = item.waybill ? (item.waybill.waybillNo || item.waybill.thirdWaybillNo) : null;
        if (waybillNo) {
            foundDataMap.set(waybillNo.toUpperCase(), item);
        }
    });

    let html = '';

    requestedNos.forEach(reqNo => {
        const reqUpper = reqNo.toUpperCase();
        let item = foundDataMap.get(reqUpper);
        
        // If not found by exact match, try to find any that contains it (just in case)
        if (!item) {
            for (let [key, val] of foundDataMap.entries()) {
                if (key.includes(reqUpper) || reqUpper.includes(key)) {
                    item = val;
                    break;
                }
            }
        }

        let firstBaggingNode = null;

        if (item && item.list) {
            const allEvents = [];
            item.list.forEach(group => {
                if (group.trackList) {
                    group.trackList.forEach(node => {
                        allEvents.push({
                            ts: parseDate(group.operationTime + ' ' + node.operationTime),
                            date: group.operationTime + ' ' + node.operationTime,
                            desc: node.es_context || node.pub_es_context || '',
                            loc: node.location || '',
                            operator: node.create_by_name || node.createByName || ''
                        });
                    });
                }
            });

            // Sort chronologically (oldest first)
            allEvents.sort((a, b) => a.ts - b.ts);

            // Find the first "Bagging the parcel in" matching the locFilter (if any)
            firstBaggingNode = allEvents.find(ev => {
                const isBagging = (ev.desc || '').toLowerCase().includes('bagging the parcel');
                if (!isBagging) return false;
                if (!locFilter) return true;
                return (ev.loc || '').toUpperCase().includes(locFilter);
            });
        }

        if (!item) {
            currentResultsData.push({ waybill: reqNo, status: '未查到运单', date: '', operator: '', loc: '' });
            html += `<tr>
                <td style="font-weight:600; color:var(--primary);">${escapeHtml(reqNo)}</td>
                <td><span class="status-badge status-not-found">未查到运单</span></td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            </tr>`;
        } else if (!firstBaggingNode) {
            const statusText = locFilter ? `未在 ${locFilter} 找到Bagging` : '无Bagging记录';
            currentResultsData.push({ waybill: reqNo, status: statusText, date: '', operator: '', loc: '' });
            html += `<tr>
                <td style="font-weight:600; color:var(--primary);">${escapeHtml(reqNo)}</td>
                <td><span class="status-badge status-not-found">${escapeHtml(statusText)}</span></td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            </tr>`;
        } else {
            currentResultsData.push({ 
                waybill: reqNo, 
                status: '已找到', 
                date: firstBaggingNode.date, 
                operator: firstBaggingNode.operator, 
                loc: firstBaggingNode.loc 
            });
            html += `<tr>
                <td style="font-weight:600; color:var(--primary);">${escapeHtml(reqNo)}</td>
                <td><span class="status-badge status-found">已找到</span></td>
                <td>${escapeHtml(firstBaggingNode.date)}</td>
                <td style="font-weight:600;">${escapeHtml(firstBaggingNode.operator || '-')}</td>
                <td>${escapeHtml(firstBaggingNode.loc || '-')}</td>
            </tr>`;
        }
    });

    elements.resultsTbody.innerHTML = html;
    elements.tableWrapper.classList.remove('hidden');
    elements.exportBtn.classList.remove('hidden');
}

const parseDate = (d) => {
    if (!d) return 0;
    if (typeof d === 'string' && d.includes('-') && d.includes(':')) {
        return new Date(d.replace(/-/g, '/')).getTime();
    }
    const t = Date.parse(d);
    return isNaN(t) ? 0 : t;
};

function handleExport() {
    if (currentResultsData.length === 0) return;
    
    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += "运单号,查询状态,首个Bagging时间,操作人,网点/位置\n";
    
    currentResultsData.forEach(row => {
        csv += `"${row.waybill}","${row.status}","${row.date}","${row.operator}","${row.loc}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `错分操作人检查_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', init);
