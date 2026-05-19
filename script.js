const elements = {
    tokenInput: document.getElementById('token'),
    cookieInput: document.getElementById('cookie'),
    saveConfigBtn: document.getElementById('save-config'),
    orderNosInput: document.getElementById('order-nos'),
    queryTypeSelect: document.getElementById('query-type'),
    searchBtn: document.getElementById('search-btn'),
    resultsContainer: document.getElementById('results-container'),
    modal: document.getElementById('detail-modal'),
    closeModal: document.querySelector('.close-modal'),
    timeline: document.getElementById('timeline'),
    currentTime: document.getElementById('current-time')
};

let currentResults = [];

// Init
async function init() {
    updateTime();
    setInterval(updateTime, 1000);
    
    // Load saved config
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.token) elements.tokenInput.value = data.token;
        if (data.cookie) elements.cookieInput.value = data.cookie;
    } catch (e) {
        console.error('Failed to load config', e);
    }
}

function updateTime() {
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleString('zh-CN', { 
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// Save Config
elements.saveConfigBtn.addEventListener('click', async () => {
    const token = elements.tokenInput.value.trim();
    const cookie = elements.cookieInput.value.trim();
    
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, cookie })
        });
        if (res.ok) {
            alert('配置已保存');
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('保存失败: ' + (errData.error || '未知错误'));
        }
    } catch (e) {
        alert('连接服务器失败');
    }
});

// Search
elements.searchBtn.addEventListener('click', async () => {
    const rawVal = elements.orderNosInput.value;
    const orderNos = rawVal.split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    if (orderNos.length === 0) {
        alert('请输入单号');
        return;
    }

    setLoading(true);
    elements.resultsContainer.innerHTML = '';

    try {
        const queryType = elements.queryTypeSelect.value || '1';

        const res = await fetch('/api/tracking', {
            method: 'POST',
            body: JSON.stringify({
                orderNos: orderNos,
                queryType: queryType,
                delStatus: "0"
            })
        });

        const data = await res.json();
        
        if (data.code === 200 && data.data) {
            renderResults(data.data);
        } else {
            showError(data.msg || data.error || '查询失败');
        }
    } catch (e) {
        showError('无法连接到代理服务器，请确保 server.py 正在运行');
    } finally {
        setLoading(false);
    }
});

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

function renderResults(results) {
    currentResults = results;
    if (!results || results.length === 0) {
        elements.resultsContainer.innerHTML = `
            <div class="empty-state">
                <p>未找到匹配的记录</p>
            </div>
        `;
        return;
    }

    elements.resultsContainer.innerHTML = results.map((item, index) => {
        const waybillNo = item.waybill ? (item.waybill.waybillNo || item.waybill.thirdWaybillNo || '未知单号') : '未知单号';
        let status = item.waybill ? (item.waybill.exceptionStatusName || '进行中') : '未知状态';

        const allEvents = [];
        if (item.list) {
            item.list.forEach(group => {
                if (group.trackList) {
                    group.trackList.forEach(node => {
                        allEvents.push({
                            date: group.operationTime + ' ' + node.operationTime,
                            desc: node.es_context || node.pub_es_context || '',
                            loc: node.location || ''
                        });
                    });
                }
            });
        }

        const parseDate = (d) => {
            const parts = d.split(' ');
            if(parts.length >= 3) {
                const dp = parts[1].split('/');
                const tp = parts[2].split(':');
                if(dp.length === 3 && tp.length >= 2) {
                    return new Date(dp[2], dp[1]-1, dp[0], tp[0], tp[1], tp[2]||0).getTime();
                }
            }
            return 0;
        };

        let timelineHtml = '<p class="last-event" style="margin-top:1rem;">暂无轨迹数据</p>';
        let totalDurationHtml = '';
        let barChartHtml = '';
        let latestDesc = '暂无轨迹';
        let statusClass = 'latest-status-pending';
        
        if (allEvents.length > 0) {
            allEvents.forEach((ev) => ev.ts = parseDate(ev.date));
            
            const oldestEvent = allEvents[allEvents.length - 1];
            const newestEvent = allEvents[0];
            latestDesc = newestEvent ? newestEvent.desc : '暂无轨迹';
            const isDelivered = latestDesc.toLowerCase().includes('delivered') || status === '已送达' || status === '已签收';
            statusClass = isDelivered ? 'latest-status-delivered' : 'latest-status-pending';
            const deliveredEvent = allEvents.find(ev => ev.desc && ev.desc.toLowerCase().includes('delivered'));
            
            let globalDiffMs = 0;
            if (deliveredEvent) {
                status = '已送达';
                globalDiffMs = deliveredEvent.ts > 0 && oldestEvent.ts > 0 ? deliveredEvent.ts - oldestEvent.ts : 0;
            } else {
                globalDiffMs = oldestEvent.ts > 0 ? Date.now() - oldestEvent.ts : 0;
            }

            if (globalDiffMs > 0) {
                const diffHours = globalDiffMs / (1000 * 60 * 60);
                const days = Math.floor(diffHours / 24);
                const hours = (diffHours % 24).toFixed(1);
                const durationStr = days > 0 ? `${days}天 ${hours}小时` : `${diffHours.toFixed(1)}小时`;
                
                if (deliveredEvent) {
                    totalDurationHtml = `<span class="status-badge" style="background: rgba(74, 222, 128, 0.15); color: var(--success); margin-left: 0.5rem;">总历时: ${durationStr}</span>`;
                } else {
                    totalDurationHtml = `<span class="status-badge" style="background: rgba(251, 191, 36, 0.15); color: var(--warning); margin-left: 0.5rem;">已历时: ${durationStr}</span>`;
                }
            }

            let currentColorIndex = 0;
            let lastLoc = null;
            let currentBlock = [];
            const blocks = [];
            const bgColors = [
                'rgba(255, 255, 255, 0.03)',
                'rgba(56, 189, 248, 0.08)',
                'rgba(74, 222, 128, 0.08)',
                'rgba(244, 114, 182, 0.08)',
                'rgba(251, 191, 36, 0.08)',
                'rgba(167, 139, 250, 0.08)'
            ];
            const solidColors = ['#94a3b8', '#38bdf8', '#4ade80', '#f472b6', '#fbbf24', '#a78bfa'];

            for (let i = allEvents.length - 1; i >= 0; i--) {
                const node = allEvents[i];
                if (node.loc && lastLoc !== null && node.loc !== lastLoc) {
                    currentColorIndex++;
                    blocks.push(currentBlock);
                    currentBlock = [];
                }
                if (node.loc) {
                    lastLoc = node.loc;
                }
                node.bgColor = bgColors[currentColorIndex % bgColors.length];
                currentBlock.push(node);
            }
            if (currentBlock.length > 0) {
                blocks.push(currentBlock);
            }

            blocks.forEach((block, i) => {
                const blockId = `block-${waybillNo.replace(/[^a-zA-Z0-9]/g, '')}-${i}`;
                
                if (block.length > 0) {
                    // Visually the newest node is the top of the block
                    block[block.length - 1].blockId = blockId;
                }

                if (block.length > 0) {
                    const firstNode = block[0]; // oldest
                    const lastNode = block[block.length - 1]; // newest
                    
                    let diffMs = 0;
                    if (i === blocks.length - 1 && !deliveredEvent) {
                        if (firstNode.ts > 0) diffMs = Date.now() - firstNode.ts;
                    } else if (lastNode.ts > 0 && firstNode.ts > 0) {
                        diffMs = lastNode.ts - firstNode.ts;
                    }

                    if (diffMs > 0) {
                        const diffHours = diffMs / (1000 * 60 * 60);
                        const days = Math.floor(diffHours / 24);
                        const hours = (diffHours % 24).toFixed(1);
                        const durationStr = days > 0 ? `${days}天 ${hours}小时` : `${diffHours.toFixed(1)}小时`;
                        
                        const validLocNode = block.find(n => n.loc);
                        const locName = validLocNode ? validLocNode.loc : '该地';
                        
                        lastNode.stayDuration = `停留 ${durationStr}`;
                        lastNode.stayLoc = locName;
                        lastNode.isOver24h = diffHours > 24;
                    }
                }
            });

            if (globalDiffMs > 0 && blocks.length > 0) {
                const segments = [];
                let totalStayMs = 0;
                
                blocks.forEach((block, i) => {
                    const firstNode = block[0]; // oldest
                    const lastNode = block[block.length - 1]; // newest
                    
                    let stayDuration = 0;
                    if (i === blocks.length - 1 && !deliveredEvent && firstNode.ts > 0) {
                        stayDuration = Date.now() - firstNode.ts;
                    } else if (lastNode.ts > 0 && firstNode.ts > 0 && lastNode.ts >= firstNode.ts) {
                        stayDuration = lastNode.ts - firstNode.ts;
                    }

                    if (stayDuration > 0) {
                        const validLocNode = block.find(n => n.loc);
                        const locName = validLocNode ? validLocNode.loc : '未知';
                        segments.push({
                            loc: locName,
                            durationMs: stayDuration,
                            color: solidColors[i % solidColors.length],
                            blockIdx: i
                        });
                        totalStayMs += stayDuration;
                    }
                });

                const barsHtml = segments.map(seg => {
                    if (seg.durationMs === 0 || totalStayMs === 0) return '';
                    const pct = (seg.durationMs / totalStayMs * 100).toFixed(2);
                    
                    const diffHours = seg.durationMs / 3600000;
                    const days = Math.floor(diffHours / 24);
                    const hrs = (diffHours % 24).toFixed(1);
                    const durationStr = days > 0 ? `${days}天 ${hrs}小时` : `${diffHours.toFixed(1)}小时`;
                    
                    const targetId = `block-${waybillNo.replace(/[^a-zA-Z0-9]/g, '')}-${seg.blockIdx}`;
                    
                    return `
                        <div onclick="const t = document.getElementById('${targetId}'); if(t) { t.scrollIntoView({behavior: 'smooth', block: 'center'}); t.querySelector('.timeline-content').style.transform = 'scale(1.02)'; setTimeout(()=> t.querySelector('.timeline-content').style.transform = 'none', 400); }" style="width: ${pct}%; height: 100%; background: ${seg.color}; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; font-size: 0.75rem; color: rgba(255,255,255,1); font-weight: 600; text-shadow: 0px 1px 3px rgba(0,0,0,0.8), 0px 0px 2px rgba(0,0,0,0.8); cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.opacity='1'; this.style.filter='brightness(1.1)';" onmouseout="this.style.opacity='0.9'; this.style.filter='none';" title="${seg.loc} 停留: ${durationStr}">
                            <span style="padding: 0 4px; line-height: 1.2;">${seg.loc}</span>
                            <span style="padding: 0 4px; line-height: 1.2; font-size: 0.7rem; color: rgba(255,255,255,0.9); font-weight: 500;">${durationStr}</span>
                        </div>
                    `;
                }).join('');

                barChartHtml = `
                    <div class="progress-bar-container" style="width: 100%; height: 60px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; overflow: hidden; margin-top: 10px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                        ${barsHtml}
                    </div>
                `;
            }

            timelineHtml = '<div class="timeline" style="margin-top: 1.5rem;">' + allEvents.map((node, i) => {
                let intervalHtml = '';
                if (i < allEvents.length - 1) {
                    const nextNode = allEvents[i + 1];
                    if (node.ts > 0 && nextNode.ts > 0) {
                        let diffMs = Math.abs(node.ts - nextNode.ts);
                        let diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
                        intervalHtml = `<div class="timeline-interval">↑ 间隔 ${diffHours} 小时</div>`;
                    }
                }
                const tags = [];
                const lowerDesc = (node.desc || '').toLowerCase();
                if (lowerDesc.includes('signed in')) tags.push('<span style="background:rgba(167,139,250,0.15);color:#8b5cf6;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(139,92,246,0.15);">签入</span>');
                if (lowerDesc.includes('bagging the parcel')) tags.push('<span style="background:rgba(56,189,248,0.15);color:#0ea5e9;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(14,165,233,0.15);">集包</span>');
                if (lowerDesc.includes('left from')) tags.push('<span style="background:rgba(251,191,36,0.15);color:#d97706;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(217,119,6,0.15);">离站</span>');
                const tagHtml = tags.length > 0 ? `<div style="display:flex; flex-direction:column; gap:6px;">${tags.join('')}</div>` : '';

                return `
                    <div class="timeline-item" ${node.blockId ? `id="${node.blockId}"` : ''}>
                        <div class="timeline-dot"></div>
                        <div class="timeline-content" style="background: ${node.bgColor}; transition: transform 0.3s ease; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                            <div style="flex: 1; min-width: 0;">
                                <div class="timeline-time">${node.date}</div>
                                <div class="timeline-desc">${node.desc}</div>
                                ${node.loc ? `<div class="timeline-loc" style="font-size:0.75rem; color:var(--primary); margin-top:4px">${node.loc}</div>` : ''}
                                ${node.stayDuration ? `<div class="stay-duration ${node.isOver24h ? 'stay-duration-over24h' : ''}" style="font-size:0.75rem; color:${node.isOver24h ? '#ef4444' : 'var(--accent)'}; margin-top:6px; font-weight:600; background:${node.isOver24h ? 'rgba(239,68,68,0.1)' : 'rgba(244,114,182,0.1)'}; display:inline-block; padding:2px 8px; border-radius:4px; ${node.isOver24h ? 'border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 8px rgba(239,68,68,0.2);' : ''}">⏱️ ${node.stayLoc} ${node.stayDuration}${node.isOver24h ? ' <span style="margin-left:4px">⚠️ 滞留超时</span>' : ''}</div>` : ''}
                            </div>
                            ${tagHtml}
                        </div>
                        ${intervalHtml}
                    </div>
                `;
            }).join('') + '</div>';
        }

        return `
            <div class="result-card card">
                <div class="result-header" style="flex-direction: column; align-items: stretch; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span class="waybill-no" onclick="open17TrackModal('${waybillNo}')">${waybillNo}</span>
                            <span class="badge-17track" id="badge-17track-${waybillNo}">17TRACK: 正在查询...</span>
                            ${totalDurationHtml}
                        </div>
                        <span class="status-badge">${status}</span>
                    </div>
                    ${barChartHtml}
                </div>
                ${timelineHtml}
            </div>
        `;
    }).join('');

    // Fetch 17track status asynchronously in the background
    results.forEach(item => {
        const waybillNo = item.waybill ? (item.waybill.waybillNo || item.waybill.thirdWaybillNo) : null;
        if (waybillNo && waybillNo !== '未知单号') {
            fetch17TrackStatus(waybillNo);
        }
    });
}

function showDetail(index) {
    const item = currentResults[index];
    if (!item || !item.list) return;

    const allEvents = [];
    item.list.forEach(group => {
        if (group.trackList) {
            group.trackList.forEach(node => {
                allEvents.push({
                    date: group.operationTime + ' ' + node.operationTime,
                    desc: node.es_context || node.pub_es_context || '',
                    loc: node.location || ''
                });
            });
        }
    });

    elements.timeline.innerHTML = allEvents.map(node => {
        const tags = [];
        const lowerDesc = (node.desc || '').toLowerCase();
        if (lowerDesc.includes('signed in')) tags.push('<span style="background:rgba(167,139,250,0.15);color:#8b5cf6;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(139,92,246,0.15);">签入</span>');
        if (lowerDesc.includes('bagging the parcel')) tags.push('<span style="background:rgba(56,189,248,0.15);color:#0ea5e9;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(14,165,233,0.15);">集包</span>');
        if (lowerDesc.includes('left from')) tags.push('<span style="background:rgba(251,191,36,0.15);color:#d97706;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(217,119,6,0.15);">离站</span>');
        const tagHtml = tags.length > 0 ? `<div style="display:flex; flex-direction:column; gap:6px;">${tags.join('')}</div>` : '';

        return `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content" style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="flex: 1; min-width: 0;">
                    <div class="timeline-time">${node.date}</div>
                    <div class="timeline-desc">${node.desc}</div>
                    ${node.loc ? `<div class="timeline-loc" style="font-size:0.75rem; color:var(--primary); margin-top:4px">${node.loc}</div>` : ''}
                </div>
                ${tagHtml}
            </div>
        </div>
        `;
    }).join('');

    elements.modal.classList.remove('hidden');
}

function showError(msg) {
    elements.resultsContainer.innerHTML = `
        <div class="card" style="grid-column: 1/-1; border-color: var(--error); color: var(--error); padding: 1rem;">
            Error: ${msg}
        </div>
    `;
}

// Modal closing
elements.closeModal.onclick = () => elements.modal.classList.add('hidden');

const yqModal = document.getElementById('yq-modal');
const closeYqModal = document.getElementById('close-yq-modal');
if (closeYqModal) {
    closeYqModal.onclick = () => yqModal.classList.add('hidden');
}

window.onclick = (event) => {
    if (event.target === elements.modal) elements.modal.classList.add('hidden');
    if (event.target === yqModal) yqModal.classList.add('hidden');
};

function open17TrackModal(waybillNo) {
    if (!waybillNo || waybillNo === '未知单号') {
        return;
    }
    
    const yqTitle = document.getElementById('yq-modal-title');
    const yqLink = document.getElementById('yq-external-link');
    const yqContainer = document.getElementById('YQContainer');
    
    yqTitle.textContent = `17TRACK 派送查询 - ${waybillNo}`;
    yqLink.href = `https://t.17track.net/en#nums=${waybillNo}`;
    
    // Clear container and show loading
    yqContainer.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:300px; width:100%;">
        <div class="loader" style="width:36px; height:36px; border-color:var(--primary); border-bottom-color:transparent;"></div>
    </div>`;
    
    // Show modal
    yqModal.classList.remove('hidden');
    
    // Invoke 17TRACK Widget
    if (window.YQV5) {
        try {
            window.YQV5.trackSingle({
                YQ_ContainerId: "YQContainer",
                YQ_Height: 560,
                YQ_Fc: "0",
                YQ_Lang: "en",
                YQ_Num: waybillNo
            });
        } catch (err) {
            console.error('YQV5 tracking initialization failed', err);
            yqContainer.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--error);">
                加载 17TRACK 失败，请尝试 <a href="https://t.17track.net/en#nums=${waybillNo}" target="_blank" style="color: var(--primary); text-decoration: underline;">在新窗口中打开</a>
            </div>`;
        }
    } else {
        yqContainer.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--error);">
            17TRACK 外部插件未加载，请尝试 <a href="https://t.17track.net/en#nums=${waybillNo}" target="_blank" style="color: var(--primary); text-decoration: underline;">在新窗口中打开</a>
        </div>`;
    }
}

async function fetch17TrackStatus(waybillNo) {
    const badge = document.getElementById(`badge-17track-${waybillNo}`);
    if (!badge) return;
    
    try {
        const res = await fetch(`/api/17track?waybill=${encodeURIComponent(waybillNo)}`);
        const data = await res.json();
        
        if (data.success) {
            let displayText = '17TRACK: ';
            if (data.status) {
                displayText += data.status;
                if (data.status.toLowerCase().includes('delivered') || data.status.includes('已签收') || data.status.includes('已送达')) {
                    badge.classList.add('delivered');
                } else if (data.status.toLowerCase().includes('not found') || data.status.includes('查询不到') || data.status.includes('未找到')) {
                    badge.classList.add('not-found');
                }
            }
            if (data.latest_event) {
                displayText += ` - ${data.latest_event}`;
            }
            if (!data.status && !data.latest_event) {
                displayText += '无轨迹信息';
            }
            badge.innerText = displayText;
            badge.title = displayText;
        } else {
            badge.innerText = '17TRACK: 查询失败';
            badge.classList.add('not-found');
        }
    } catch (e) {
        badge.innerText = '17TRACK: 接口异常';
        badge.classList.add('not-found');
    }
}

init();
