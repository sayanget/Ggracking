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
    fetchStartTime: document.getElementById('fetch-start-time'),
    fetchEndTime: document.getElementById('fetch-end-time'),
    fetchBtn: document.getElementById('fetch-waybills-btn'),
    fetchResultHint: document.getElementById('fetch-result-hint'),
    feishuUrlInput: document.getElementById('feishu-url-input'),
    feishuOpenLink: document.getElementById('feishu-open-link'),
    exportStatsBtn: document.getElementById('export-stats-btn'),
    statsWrapper: document.getElementById('stats-wrapper'),
    statsTbody: document.getElementById('stats-tbody')
};

let currentResultsData = [];
let currentStatsData = [];

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
    if (elements.exportStatsBtn) elements.exportStatsBtn.addEventListener('click', handleExportStats);
    if (elements.fetchBtn) elements.fetchBtn.addEventListener('click', handleFetchAndSearch);

    if (elements.feishuUrlInput && elements.feishuOpenLink) {
        elements.feishuUrlInput.addEventListener('input', () => {
            const val = elements.feishuUrlInput.value.trim();
            if (val) elements.feishuOpenLink.href = val;
        });
    }
    
    // Set default datetime to today
    if (elements.fetchStartTime && elements.fetchEndTime) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        elements.fetchStartTime.value = formatDateTimeLocal(start);
        elements.fetchEndTime.value = formatDateTimeLocal(end);
    }
}

function formatDateTimeLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
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
    elements.statsWrapper.classList.add('hidden');
    elements.emptyState.classList.add('hidden');
    elements.exportBtn.classList.add('hidden');
    if (elements.exportStatsBtn) elements.exportStatsBtn.classList.add('hidden');
    elements.resultsTbody.innerHTML = '';
    if (elements.statsTbody) elements.statsTbody.innerHTML = '';
    currentResultsData = [];
    currentStatsData = [];

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

async function handleFetchAndSearch() {
    const startTime = elements.fetchStartTime.value;
    const endTime = elements.fetchEndTime.value;
    const feishuUrlInput = document.getElementById('feishu-url-input');
    
    if (!startTime || !endTime) {
        alert('请选择完整的开始和结束时间');
        return;
    }
    
    elements.fetchBtn.disabled = true;
    const btnText = elements.fetchBtn.querySelector('.btn-text');
    const loader = elements.fetchBtn.querySelector('.loader');
    if (elements.fetchResultHint) elements.fetchResultHint.textContent = '';
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');

    let token = "N1p9sXOXHhEc9MtxzddczZcznih";
    let sheetId = "CKFxKV";

    if (feishuUrlInput) {
        const feishuUrl = feishuUrlInput.value.trim();
        try {
            const urlObj = new URL(feishuUrl);
            const pathParts = urlObj.pathname.split('/');
            const sheetsIndex = pathParts.indexOf('sheets');
            if (sheetsIndex !== -1 && pathParts.length > sheetsIndex + 1) {
                token = pathParts[sheetsIndex + 1];
            }
            const params = new URLSearchParams(urlObj.search);
            if (params.has('sheet')) {
                sheetId = params.get('sheet');
            }
        } catch (e) {
            console.warn("Invalid Feishu URL format, falling back to default.", e);
        }
    }

    try {
        const res = await fetch(getApiBase() + `/api/feishu-sheet?token=${encodeURIComponent(token)}&sheetId=${encodeURIComponent(sheetId)}`);
        const data = await res.json();
        
        if (!data.success || !data.data || !data.data.data || !data.data.data.valueRange) {
            throw new Error(data.error || '获取飞书表格数据失败，请检查服务配置');
        }
        
        const rows = data.data.data.valueRange.values || [];
        const fetchedWaybills = [];
        const startTs = new Date(startTime).getTime();
        const endTs = new Date(endTime).getTime();

        // 跳过可能存在的表头
        let startIndex = 0;
        if (rows.length > 0 && typeof rows[0][0] === 'string' && (rows[0][0].includes('时间') || rows[0][0].includes('日期'))) {
            startIndex = 1;
        }

        const locFilter = elements.locFilterInput ? elements.locFilterInput.value.trim().toUpperCase() : 'CNO.H';
        let missingDeptCount = 0;

        for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            const timeStr = row[0]; // D列
            const waybill = row[1]; // E列
            const dept = row[4];    // H列 (D=0, E=1, F=2, G=3, H=4)

            if (dept === undefined) {
                missingDeptCount++;
            }

            if (timeStr && waybill) {
                const ts = parseDate(timeStr);
                const deptStr = dept ? String(dept).toUpperCase() : '';
                const matchDept = locFilter === '' || deptStr.includes(locFilter);

                if (ts >= startTs && ts <= endTs && matchDept) {
                    fetchedWaybills.push(String(waybill).trim());
                }
            }
        }

        const uniqueWaybills = [...new Set(fetchedWaybills)];

        if (uniqueWaybills.length === 0) {
            if (missingDeptCount > 0) {
                alert(`拦截原因提示：未能拉取到【责任部门】(H列) 的数据。\n这通常是因为后端的 server.py 还未完全重启生效（它仍在抓取旧的D到E列）。\n\n请您在黑色终端窗口按下 Ctrl+C 停止服务，然后重新双击 start_web.bat 启动服务，再刷新页面重试！`);
            } else {
                alert('该时间段内未在飞书表格中拉取到任何有效运单，请确认时间范围以及网点筛选条件。');
            }
        } else {
            if (elements.fetchResultHint) {
                elements.fetchResultHint.textContent = `✅ 成功拉取 ${uniqueWaybills.length} 条`;
            }
            // Update textarea and trigger search
            elements.orderNosInput.value = uniqueWaybills.join('\n');
            await handleSearch();
        }
    } catch (e) {
        alert('拉取运单号失败: ' + e.message);
    } finally {
        elements.fetchBtn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
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
                        let tStr = '';
                        if (node.operationTime && group.operationTime) {
                            if (!String(node.operationTime).includes('-')) {
                                tStr = group.operationTime + ' ' + node.operationTime;
                            } else {
                                tStr = node.operationTime;
                            }
                        } else {
                            tStr = node.operationTime || group.operationTime || '';
                        }
                        
                        allEvents.push({
                            ts: parseDate(tStr),
                            date: tStr,
                            desc: node.es_context || node.pub_es_context || '',
                            loc: node.location || '',
                            operator: node.create_by_name || node.createByName || ''
                        });
                    });
                }
            });

            // Sort chronologically (oldest first)
            allEvents.sort((a, b) => a.ts - b.ts);

            // Find the first "Bagging the parcel" matching the locFilter (if any)
            firstBaggingNode = allEvents.find(ev => {
                const descStr = (ev.desc || '').toUpperCase();
                const locStr = (ev.loc || '').toUpperCase();
                const isBagging = descStr.includes('BAGGING THE PARCEL');
                if (!isBagging) return false;
                if (!locFilter) return true;
                // 有些情况下 API 的 location 字段可能为空，但 desc 里包含 "in CNO.H"
                return locStr.includes(locFilter) || descStr.includes(locFilter);
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

    // Calculate Stats
    const statsMap = new Map();
    let totalFound = 0;
    
    currentResultsData.forEach(row => {
        if (row.status === '已找到') {
            totalFound++;
            const op = (row.operator || '未知操作人').trim();
            statsMap.set(op, (statsMap.get(op) || 0) + 1);
        }
    });

    if (totalFound > 0) {
        const sortedStats = Array.from(statsMap.entries()).sort((a, b) => b[1] - a[1]);
        let statsHtml = '';
        currentStatsData = [];
        
        sortedStats.forEach(([op, count]) => {
            const ratio = ((count / totalFound) * 100).toFixed(2) + '%';
            currentStatsData.push({ operator: op, count: count, ratio: ratio });
            statsHtml += `<tr>
                <td style="font-weight:600;">${escapeHtml(op)}</td>
                <td style="color:var(--error); font-weight:600;">${count}</td>
                <td style="color:var(--text-muted);">${ratio}</td>
            </tr>`;
        });

        statsHtml += `<tr>
            <td style="font-weight:bold; background:rgba(255,255,255,0.05);">总计</td>
            <td style="font-weight:bold; color:var(--error); background:rgba(255,255,255,0.05);">${totalFound}</td>
            <td style="font-weight:bold; background:rgba(255,255,255,0.05);">100.00%</td>
        </tr>`;

        if (elements.statsTbody) elements.statsTbody.innerHTML = statsHtml;
        if (elements.statsWrapper) elements.statsWrapper.classList.remove('hidden');
        if (elements.exportStatsBtn) elements.exportStatsBtn.classList.remove('hidden');
    }
}

const parseDate = (d) => {
    if (!d) return 0;
    
    // Clean up any stray undefined strings
    let strD = String(d).replace(/undefined/g, '').trim();
    if (!strD) return 0;
    
    // Handle Feishu/Excel serial date format (e.g. 46193.00069444445 for 2026-06-20)
    if (typeof d === 'number' || (typeof strD === 'string' && !isNaN(Number(strD)))) {
        const num = Number(strD);
        if (num > 30000 && num < 100000) {
            const unixMs = Math.round((num - 25569) * 86400 * 1000);
            const dateObj = new Date(unixMs);
            return unixMs + (dateObj.getTimezoneOffset() * 60 * 1000); 
        }
    }

    if (strD.includes('-') && strD.includes(':')) {
        return new Date(strD.replace(/-/g, '/')).getTime();
    }
    const t = Date.parse(strD);
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

function handleExportStats() {
    if (currentStatsData.length === 0) return;
    
    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += "操作人,错分单量,单量占比\n";
    
    let totalCount = 0;
    currentStatsData.forEach(row => {
        csv += `"${row.operator}","${row.count}","${row.ratio}"\n`;
        totalCount += row.count;
    });
    
    csv += `"总计","${totalCount}","100.00%"\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `错分操作人统计_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', init);
