const elements = {
    proxyUrlInput: document.getElementById('proxy-url'),
    tokenInput: document.getElementById('token'),
    cookieInput: document.getElementById('cookie'),
    saveConfigBtn: document.getElementById('save-config'),
    orderNosInput: document.getElementById('order-nos'),
    queryTypeSelect: document.getElementById('query-type'),
    searchBtn: document.getElementById('search-btn'),
    exportBtn: document.getElementById('export-btn'),
    resultsContainer: document.getElementById('results-container'),
    modal: document.getElementById('detail-modal'),
    closeModal: document.querySelector('.close-modal'),
    timeline: document.getElementById('timeline'),
    currentTime: document.getElementById('current-time'),
    themeToggleBtn: document.getElementById('theme-toggle'),
    
    // DMS login elements
    dmsPhoneInput: document.getElementById('dms-phone'),
    dmsPwdInput: document.getElementById('dms-pwd'),
    dmsCaptchaInput: document.getElementById('dms-captcha'),
    dmsCaptchaImg: document.getElementById('dms-captcha-img'),
    dmsCaptchaLoading: document.getElementById('dms-captcha-loading'),
    dmsCaptchaContainer: document.getElementById('dms-captcha-container'),
    dmsLoginBtn: document.getElementById('dms-login-btn'),

    // Scanner elements
    scanBtn: document.getElementById('scan-btn'),
    scanModal: document.getElementById('scan-modal'),
    closeScanModal: document.getElementById('close-scan-modal')
};

let currentResults = [];
let captchaUuid = '';

function getApiBase() {
    const proxyUrl = elements.proxyUrlInput ? elements.proxyUrlInput.value.trim() : '';
    if (proxyUrl) {
        // Strip trailing slash if present
        return proxyUrl.replace(/\/+$/, '');
    }
    return '';
}

// Init
async function init() {
    updateTime();
    setInterval(updateTime, 1000);
    
    // Init Today Queries count
    updateTodayQueries();
    
    // Initialize Theme (Default is dark theme for premium aesthetics)
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
    
    // Load saved config
    // 1. Load from localStorage first (for instantaneous render and static deployment fallback)
    const localProxyUrl = localStorage.getItem('gtracking-proxy-url');
    const localToken = localStorage.getItem('gtracking-token');
    const localCookie = localStorage.getItem('gtracking-cookie');
    if (localProxyUrl && elements.proxyUrlInput) elements.proxyUrlInput.value = localProxyUrl;
    if (localToken) elements.tokenInput.value = localToken;
    if (localCookie && elements.cookieInput) elements.cookieInput.value = localCookie;

    // 2. Fetch from backend API to synchronize if server is running
    try {
        const res = await fetch(getApiBase() + '/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data.token) {
                elements.tokenInput.value = data.token;
                localStorage.setItem('gtracking-token', data.token);
            }
            if (data.cookie && elements.cookieInput) {
                elements.cookieInput.value = data.cookie;
                localStorage.setItem('gtracking-cookie', data.cookie);
            }
        }
    } catch (e) {
        console.warn('Unable to load from server.py backend, using localStorage configuration fallback.', e);
    }

    // Load DMS captcha
    fetchDmsCaptcha();
    if (elements.dmsCaptchaContainer) {
        elements.dmsCaptchaContainer.addEventListener('click', fetchDmsCaptcha);
    }
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', exportToCSV);
    }
    
    // Initialize Barcode/QR Code scanner
    initBarcodeScanner();
}

let html5QrCode = null;

function initBarcodeScanner() {
    if (!elements.scanBtn || !elements.scanModal || !elements.closeScanModal) return;

    elements.scanBtn.addEventListener('click', () => {
        elements.scanModal.classList.remove('hidden');
        startScanner();
    });

    elements.closeScanModal.addEventListener('click', () => {
        stopScanner();
        elements.scanModal.classList.add('hidden');
    });
}

function startScanner() {
    const feedback = document.getElementById('scan-feedback');
    if (!feedback) return;

    feedback.textContent = '正在激活摄像头...';
    feedback.style.color = 'var(--text-muted)';

    try {
        // Instantiate html5QrCode scanner once and reuse it
        if (!html5QrCode) {
            const formats = [];
            if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
                formats.push(
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.ITF
                );
            }
            html5QrCode = new Html5Qrcode("reader", {
                verbose: false,
                formatsToSupport: formats.length > 0 ? formats : undefined
            });
        }

        // If already scanning, just update feedback and return
        if (html5QrCode.isScanning) {
            feedback.textContent = '📷 对准条形码或二维码即可自动识别';
            return;
        }

        // Barcode scanner configuration
        const config = {
            fps: 15, // High frame rate for fast express barcode reading
            qrbox: (width, height) => {
                // Wide rectangular scan box suitable for express shipping barcodes
                const w = Math.min(width * 0.9, 390);
                const h = Math.min(height * 0.4, 150);
                return { width: w, height: h };
            },
            aspectRatio: 1.0
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText, decodedResult) => {
                if (decodedText) {
                    // Play a brief haptic vibration if supported
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }

                    // Add waybill number to the textarea
                    const currentVal = elements.orderNosInput.value.trim();
                    if (currentVal) {
                        const list = currentVal.split('\n');
                        if (!list.includes(decodedText)) {
                            elements.orderNosInput.value = currentVal + '\n' + decodedText;
                        }
                    } else {
                        elements.orderNosInput.value = decodedText;
                    }

                    feedback.textContent = `🎉 扫码成功: ${decodedText}`;
                    feedback.style.color = 'var(--success)';

                    // Automatically stop and close scanner after a brief delay
                    setTimeout(() => {
                        stopScanner();
                        elements.scanModal.classList.add('hidden');
                    }, 800);
                }
            },
            (errorMessage) => {
                // Silence frame processing parse failures
            }
        ).then(() => {
            feedback.textContent = '📷 对准条形码或二维码即可自动识别';
            feedback.style.color = 'var(--text-muted)';
        }).catch(err => {
            console.error("Camera access error:", err);
            feedback.textContent = `❌ 无法启动摄像头: ${err.message || err || '请确保授予了相机权限，且在 HTTPS 环境下打开'}`;
            feedback.style.color = 'var(--error)';
        });
    } catch (e) {
        console.error("Scanner setup failed:", e);
        feedback.textContent = `❌ 初始化扫码失败: ${e.message || e}`;
        feedback.style.color = 'var(--error)';
    }
}

function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            console.log("Scanner stopped successfully");
        }).catch(err => {
            console.error("Stop scanner error:", err);
        });
    }
}

function updateThemeIcon(theme) {
    const iconSpan = elements.themeToggleBtn ? elements.themeToggleBtn.querySelector('.theme-icon') : null;
    if (iconSpan) {
        iconSpan.textContent = theme === 'light' ? '☀️' : '🌙';
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
    const proxyUrl = elements.proxyUrlInput ? elements.proxyUrlInput.value.trim() : '';
    const token = elements.tokenInput.value.trim();
    const cookie = elements.cookieInput ? elements.cookieInput.value.trim() : '';
    
    // Always save to localStorage first
    localStorage.setItem('gtracking-proxy-url', proxyUrl);
    localStorage.setItem('gtracking-token', token);
    localStorage.setItem('gtracking-cookie', cookie);
    
    try {
        const res = await fetch(getApiBase() + '/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, cookie })
        });
        if (res.ok) {
            alert('配置已同步保存到服务器！');
        } else {
            console.warn('Server failed to save config, keeping in localStorage.');
            alert('配置已成功保存至本地浏览器（静态代理模式）');
        }
    } catch (e) {
        console.warn('Server connection failed, keeping in localStorage.', e);
        alert('配置已成功保存至本地浏览器（静态代理模式）');
    }
});

// Fetch DMS Captcha Image
async function fetchDmsCaptcha() {
    if (!elements.dmsCaptchaImg || !elements.dmsCaptchaLoading) return;
    
    elements.dmsCaptchaLoading.classList.remove('hidden');
    elements.dmsCaptchaImg.classList.add('hidden');
    
    try {
        const res = await fetch(getApiBase() + '/api/captcha');
        if (!res.ok) throw new Error('API returns error ' + res.status);
        const data = await res.json();
        
        if (data.img) {
            elements.dmsCaptchaImg.src = 'data:image/jpeg;base64,' + data.img;
            elements.dmsCaptchaImg.classList.remove('hidden');
            captchaUuid = data.uuid || '';
        } else {
            console.error('No captcha image in response', data);
        }
    } catch (e) {
        console.error('Failed to load captcha:', e);
    } finally {
        elements.dmsCaptchaLoading.classList.add('hidden');
    }
}

// DMS Quick Login Button Listener
if (elements.dmsLoginBtn) {
    elements.dmsLoginBtn.addEventListener('click', async () => {
        const username = elements.dmsPhoneInput.value.trim();
        const password = elements.dmsPwdInput.value;
        const code = elements.dmsCaptchaInput.value.trim();
        
        if (!username) {
            alert('请输入手机号/账号');
            return;
        }
        if (!password) {
            alert('请输入密码');
            return;
        }
        if (!code) {
            alert('请输入验证码');
            return;
        }
        if (!captchaUuid) {
            alert('验证码 UUID 未加载，请刷新验证码');
            return;
        }
        
        const btnText = elements.dmsLoginBtn.querySelector('.btn-text');
        const btnLoader = elements.dmsLoginBtn.querySelector('.loader');
        
        elements.dmsLoginBtn.disabled = true;
        if (btnText) btnText.style.opacity = '0.5';
        if (btnLoader) btnLoader.classList.remove('hidden');
        
        try {
            const res = await fetch(getApiBase() + '/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    code,
                    uuid: captchaUuid
                })
            });
            
            const data = await res.json();
            if (data.code === 200) {
                alert('登录成功！已自动获取并保存 Token');
                if (data.token) {
                    elements.tokenInput.value = data.token;
                    localStorage.setItem('gtracking-token', data.token);
                }
                // Also load saved cookies if returned
                try {
                    const confRes = await fetch(getApiBase() + '/api/config');
                    if (confRes.ok) {
                        const confData = await confRes.json();
                        if (confData.cookie && elements.cookieInput) {
                            elements.cookieInput.value = confData.cookie;
                            localStorage.setItem('gtracking-cookie', confData.cookie);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to reload cookie config from server, keeping local session:', e);
                }
                elements.dmsCaptchaInput.value = '';
                await fetchDmsCaptcha();
            } else {
                alert('登录失败: ' + (data.msg || data.error || '未知错误'));
                elements.dmsCaptchaInput.value = '';
                await fetchDmsCaptcha();
            }
        } catch (e) {
            console.error(e);
            alert('网络连接错误，登录请求失败');
        } finally {
            elements.dmsLoginBtn.disabled = false;
            if (btnText) btnText.style.opacity = '1';
            if (btnLoader) btnLoader.classList.add('hidden');
        }
    });
}

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
    if (elements.exportBtn) elements.exportBtn.classList.add('hidden');

    try {
        const queryType = elements.queryTypeSelect.value || '1';

        const res = await fetch(getApiBase() + '/api/tracking', {
            method: 'POST',
            body: JSON.stringify({
                orderNos: orderNos,
                queryType: queryType,
                delStatus: "0"
            })
        });

        const data = await res.json();
        
        if (data.code === 200 && data.data) {
            updateTodayQueries(true);
            renderResults(data.data);
        } else {
            showError(data.msg || data.error || '查询失败');
        }
    } catch (e) {
        showError('无法连接到代理服务器。如果您在 Netlify/静态部署上运行，请在左侧“手动配置”中填写您的“代理服务器地址”（例如 http://您的服务器IP:7000），并确保您的 server.py 代理服务已启动。');
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

const parseDate = (d) => {
    if (!d) return 0;
    // Standard ISO/custom format: yyyy-mm-dd hh:mm:ss
    if (typeof d === 'string' && d.includes('-') && d.includes(':')) {
        return new Date(d.replace(/-/g, '/')).getTime();
    }
    // Custom format: 星期一, 11/05/2026 06:07:58
    const parts = d.split(' ');
    if(parts.length >= 3) {
        const dp = parts[1].split('/');
        const tp = parts[2].split(':');
        if(dp.length === 3 && tp.length >= 2) {
            return new Date(dp[2], dp[1]-1, dp[0], tp[0], tp[1], dp[2]||0).getTime();
        }
    }
    // Fallback standard parse
    const t = Date.parse(d);
    return isNaN(t) ? 0 : t;
};

// SOP 转运核心指标及安全/运营隐患分析引擎 (Based on hub_metrics_formulas.pdf)
function analyzeHubSafetyRisks(allEvents, isDelivered) {
    const alerts = [];
    if (!allEvents || allEvents.length === 0) return alerts;

    // Chronological order for sequence analysis
    const chronoEvents = [...allEvents].sort((a, b) => a.ts - b.ts);
    
    // 1. 揽收签入超时 (SOP-1: 揽收签入及时率 - 24H 限制)
    const labelEvent = chronoEvents.find(e => e.desc && (
        e.desc.toLowerCase().includes('gets the order') || 
        e.desc.toLowerCase().includes('label created') || 
        e.desc.includes('创建面单') || 
        e.desc.includes('获取订单信息')
    ));
    if (labelEvent && labelEvent.ts > 0) {
        const firstSignIn = chronoEvents.find(e => e.ts > labelEvent.ts && e.desc && (
            e.desc.toLowerCase().includes('signed in') || 
            e.desc.toLowerCase().includes('arrived at gofo') || 
            e.desc.includes('转运中心签入') || 
            e.desc.includes('网点签入')
        ));
        if (firstSignIn && firstSignIn.ts > 0) {
            const delayHours = (firstSignIn.ts - labelEvent.ts) / 3600000;
            if (delayHours > 24) {
                alerts.push({
                    type: '揽收',
                    level: 'danger',
                    message: `🚨 揽收严重超时：从建单到首次签入用时 ${delayHours.toFixed(1)} 小时，严重超过 24 小时红线标准`,
                    nodeIndex: allEvents.indexOf(firstSignIn)
                });
            }
        } else {
            const delayHours = (Date.now() - labelEvent.ts) / 3600000;
            if (delayHours > 24 && !isDelivered) {
                alerts.push({
                    type: '揽收',
                    level: 'danger',
                    message: `🚨 揽收严重延误：系统建单已达 ${delayHours.toFixed(1)} 小时，仍无任何物理揽收或签入轨迹`,
                    nodeIndex: allEvents.indexOf(labelEvent)
                });
            }
        }
    }

    // 2. 卸车签入超时 (SOP-3: 卸车签入及时率 - 2H 绝对红线)
    for (let i = 0; i < chronoEvents.length; i++) {
        const ev = chronoEvents[i];
        const lowerDesc = (ev.desc || '').toLowerCase();
        const isArrival = lowerDesc.includes('vehicle arrived') || 
                          lowerDesc.includes('vehicle has arrived') || 
                          lowerDesc.includes('arrived at') || 
                          ev.corto === '412' || ev.corto === '415' || 
                          ev.operation_move === '412' || ev.operation_move === '415';
        if (isArrival) {
            const loc = ev.loc || '';
            // Find next sign-in at same location
            const signin = chronoEvents.find(e => e.ts >= ev.ts && e !== ev && e.loc === loc && (
                e.desc.toLowerCase().includes('signed in') || 
                e.corto === '201' || e.corto === '202' || 
                e.operation_move === '201' || e.operation_move === '202'
            ));
            if (signin) {
                const diffHours = (signin.ts - ev.ts) / 3600000;
                if (diffHours > 2) {
                    alerts.push({
                        type: '卸车',
                        level: 'danger',
                        message: `🚨 卸车签入严重超时：干线车辆抵达 ${loc} 后，历时 ${diffHours.toFixed(1)} 小时才完成卸车物理签入（SOP规定时效限2小时，存在积压隐患）`,
                        nodeIndex: allEvents.indexOf(signin)
                    });
                }
            } else {
                const diffHours = (Date.now() - ev.ts) / 3600000;
                if (diffHours > 2 && !isDelivered) {
                    alerts.push({
                        type: '卸车',
                        level: 'danger',
                        message: `🚨 卸车滞留红线告警：干线车辆抵达 ${loc} 已达 ${diffHours.toFixed(1)} 小时，操作团队仍未物理激活卸车扫描！`,
                        nodeIndex: allEvents.indexOf(ev)
                    });
                }
            }
        }
    }

    // 3. HUB分拣集包超时 (SOP-2: HUB分拣及时率 - 90~120分钟/2H 时效限制)
    for (let i = 0; i < chronoEvents.length; i++) {
        const ev = chronoEvents[i];
        const lowerDesc = (ev.desc || '').toLowerCase();
        if (lowerDesc.includes('signed in') || ev.corto === '201' || ev.corto === '202' || ev.operation_move === '201' || ev.operation_move === '202') {
            const loc = ev.loc || '';
            // Find subsequent bagging
            const bagging = chronoEvents.find(e => e.ts >= ev.ts && e.loc === loc && (
                e.desc.toLowerCase().includes('bagging') || 
                e.corto === '217' || 
                e.operation_move === '217'
            ));
            if (bagging) {
                const diffHours = (bagging.ts - ev.ts) / 3600000;
                if (diffHours > 2) {
                    alerts.push({
                        type: '分拣',
                        level: 'warning',
                        message: `⚠️ 分拣操作超时：在 ${loc} 转运中心从卸车签入到集包扫描历时 ${diffHours.toFixed(1)} 小时，超出分拣效率指标标准（90-120分钟）`,
                        nodeIndex: allEvents.indexOf(bagging)
                    });
                }
            } else {
                const diffHours = (Date.now() - ev.ts) / 3600000;
                if (diffHours > 2 && !isDelivered) {
                    alerts.push({
                        type: '分拣',
                        level: 'warning',
                        message: `⚠️ 分拣流向积压：包裹在 ${loc} 转运中心已完成签入超 ${diffHours.toFixed(1)} 小时，但尚未进行集包建包操作`,
                        nodeIndex: allEvents.indexOf(ev)
                    });
                }
            }
        }
    }

    // 4. 转运中心/网点操作滞留 (SOP-4: HUB操作及时率 - 24H 强制清场时效)
    for (let i = 0; i < chronoEvents.length; i++) {
        const ev = chronoEvents[i];
        const lowerDesc = (ev.desc || '').toLowerCase();
        if (lowerDesc.includes('signed in') || lowerDesc.includes('arrived') || ev.corto === '201' || ev.corto === '202' || ev.operation_move === '201' || ev.operation_move === '202') {
            const loc = ev.loc || '';
            // Find departure / dispatch
            const checkout = chronoEvents.find(e => e.ts >= ev.ts && e.loc === loc && (
                e.desc.toLowerCase().includes('left') || 
                e.desc.toLowerCase().includes('departed') || 
                ev.corto === '200' || ev.corto === '411' || 
                ev.operation_move === '200' || ev.operation_move === '411'
            ));
            if (checkout) {
                const diffHours = (checkout.ts - ev.ts) / 3600000;
                if (diffHours > 24) {
                    alerts.push({
                        type: '操作',
                        level: 'warning',
                        message: `⚠️ 转运停留超时：包裹在 ${loc} 操作及滞留总历时 ${diffHours.toFixed(1)} 小时，违反 24 小时操作红线`,
                        nodeIndex: allEvents.indexOf(checkout)
                    });
                }
            } else {
                const diffHours = (Date.now() - ev.ts) / 3600000;
                if (diffHours > 24 && !isDelivered) {
                    alerts.push({
                        type: '操作',
                        level: 'warning',
                        message: `⚠️ 场地滞留死角：包裹已在 ${loc} 滞留停留 ${diffHours.toFixed(1)} 小时，未进行发车签出或离港扫描`,
                        nodeIndex: allEvents.indexOf(ev)
                    });
                }
            }
        }
    }

    // 5. 内部断更及丢失红线风险 (SOP-7: 内部断更+丢失率 - 120H 终极红线)
    if (!isDelivered && allEvents[0] && allEvents[0].ts > 0) {
        const newestEvent = allEvents[0];
        const idleHours = (Date.now() - newestEvent.ts) / 3600000;
        if (idleHours > 120) {
            alerts.push({
                type: '断更',
                level: 'danger',
                message: `🚨 断更灭失红线告警：包裹在 ${newestEvent.loc || '转运环节'} 连续断更超五日（达 ${idleHours.toFixed(1)} 小时），存在极高遗失、被盗或留仓死件隐患！`,
                nodeIndex: 0
            });
        }
    }

    return alerts;
}

function renderResults(results) {
    currentResults = results;
    if (!results || results.length === 0) {
        elements.resultsContainer.innerHTML = `
            <div class="empty-state">
                <p>未找到匹配的记录</p>
            </div>
        `;
        if (elements.exportBtn) elements.exportBtn.classList.add('hidden');
        return;
    }
    if (elements.exportBtn) elements.exportBtn.classList.remove('hidden');

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
                            loc: node.location || '',
                            operator: node.create_by_name || node.createByName || ''
                        });
                    });
                }
            });
        }

        let timelineHtml = '<p class="last-event" style="margin-top:1rem;">暂无轨迹数据</p>';
        let totalDurationHtml = '';
        let barChartHtml = '';
        let safetyAlertsHtml = '';
        let safetyAlerts = [];
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

            // Run safety risk analysis based on hub_metrics_formulas.pdf SOP rules
            safetyAlerts = analyzeHubSafetyRisks(allEvents, isDelivered);
            if (safetyAlerts.length > 0) {
                safetyAlertsHtml = `
                    <div class="safety-alerts-wrapper" style="margin-top: 10px; padding: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.05); text-align: left;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: #f87171; display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                            🛡️ SOP 转运运营红线隐患告警 (${safetyAlerts.length} 项)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${safetyAlerts.map(alert => `
                                <div style="font-size: 0.775rem; line-height: 1.4; color: ${alert.level === 'danger' ? '#f87171' : '#fbbf24'}; display: flex; align-items: flex-start; gap: 6px; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px; border-left: 3px solid ${alert.level === 'danger' ? '#ef4444' : '#fbbf24'};">
                                    <span>${alert.message}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Analyze IN and OUT pairing
            let lastUnpairedInNode = null;
            let deliveryIndex = -1;
            for (let i = 0; i < allEvents.length; i++) {
                const ev = allEvents[i];
                const desc = (ev.desc || '').toLowerCase();
                if (desc.includes('delivered') || desc.includes('signed') || desc.includes('已签收') || desc.includes('已送达')) {
                    deliveryIndex = i;
                    break;
                }
            }

            for (let i = allEvents.length - 1; i >= 0; i--) {
                const node = allEvents[i];
                const lowerDesc = (node.desc || '').toLowerCase();
                const isIn = lowerDesc.includes('signed in');
                const isOut = lowerDesc.includes('left sorting center');
                
                if (isIn) {
                    if (lastUnpairedInNode) {
                        lastUnpairedInNode.warning = '漏操作风险：签入后无对应签出';
                    }
                    lastUnpairedInNode = node;
                } else if (isOut) {
                    if (lastUnpairedInNode) {
                        lastUnpairedInNode = null;
                    } else {
                        node.warning = '漏操作风险：签出前无对应签入';
                    }
                }
                
                if (i === deliveryIndex) {
                    if (lastUnpairedInNode) {
                        lastUnpairedInNode = null;
                    }
                }
            }
            if (lastUnpairedInNode && lastUnpairedInNode !== allEvents[0]) {
                lastUnpairedInNode.warning = '漏操作风险：签入后无对应签出';
            }
            
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
                        const hoursVal = diffMs / (1000 * 60 * 60);
                        let diffHours = hoursVal.toFixed(1);
                        if (hoursVal > 24) {
                            intervalHtml = `<div class="timeline-interval" style="color: #f87171; background: rgba(248, 113, 113, 0.15); border: 1px solid rgba(248, 113, 113, 0.3); box-shadow: 0 0 8px rgba(248, 113, 113, 0.15); font-weight: 700;">⚠️ 间隔 ${diffHours} 小时 (操作超时)</div>`;
                        } else {
                            intervalHtml = `<div class="timeline-interval">↑ 间隔 ${diffHours} 小时</div>`;
                        }
                    }
                }
                const tags = [];
                const lowerDesc = (node.desc || '').toLowerCase();
                if (lowerDesc.includes('signed in')) tags.push('<span style="background:rgba(167,139,250,0.15);color:#8b5cf6;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(139,92,246,0.15);">签入</span>');
                if (lowerDesc.includes('left sorting center')) tags.push('<span style="background:rgba(251,146,60,0.15);color:#ea580c;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(234,88,12,0.15);">签出</span>');
                if (lowerDesc.includes('bagging the parcel')) tags.push('<span style="background:rgba(56,189,248,0.15);color:#0ea5e9;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(14,165,233,0.15);">集包</span>');
                if (lowerDesc.includes('left from')) tags.push('<span style="background:rgba(251,191,36,0.15);color:#d97706;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(217,119,6,0.15);">离站</span>');
                const tagHtml = tags.length > 0 ? `<div class="timeline-tags" style="display:flex; flex-direction:column; gap:6px;">${tags.join('')}</div>` : '';

                let shiftTagHtml = '';
                if (lowerDesc.includes('bagging the parcel')) {
                    const timePart = (node.date || '').split(' ')[1] || '';
                    const hourStr = timePart.split(':')[0] || '';
                    const hour = parseInt(hourStr, 10);
                    if (!isNaN(hour)) {
                        if (hour >= 8 && hour < 20) {
                            shiftTagHtml = `<span style="background:rgba(245,158,11,0.12); color:#f59e0b; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; border:1px solid rgba(245,158,11,0.25); display:inline-flex; align-items:center; gap:2px;">☀️ 早班</span>`;
                        } else {
                            shiftTagHtml = `<span style="background:rgba(99,102,241,0.12); color:#818cf8; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; border:1px solid rgba(99,102,241,0.25); display:inline-flex; align-items:center; gap:2px;">🌙 晚班</span>`;
                        }
                    }
                }

                // Extract node-specific SOP metrics alerts
                const nodeAlerts = safetyAlerts.filter(a => a.nodeIndex === i);
                let nodeAlertsHtml = '';
                if (nodeAlerts.length > 0) {
                    nodeAlertsHtml = nodeAlerts.map(alert => `
                        <div class="operation-warning" style="font-size:0.75rem; color:${alert.level === 'danger' ? '#ef4444' : '#fbbf24'}; margin-top:6px; font-weight:600; background:${alert.level === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)'}; display:inline-block; padding:4px 10px; border-radius:6px; border: 1px solid ${alert.level === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'}; box-shadow: 0 0 8px ${alert.level === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)'}; margin-right:8px;">
                            ${alert.level === 'danger' ? '🚨' : '⚠️'} [SOP ${alert.type}时效红线] ${alert.message.replace(/🚨|⚠️/g, '').trim()}
                        </div>
                    `).join('');
                }

                // Group action tags and operator/shift tags together on the right side
                let rightContainerHtml = '';
                if (tagHtml || shiftTagHtml || node.operator) {
                    rightContainerHtml = `
                        <div class="timeline-right" style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; min-width: fit-content; justify-content: center; z-index: 2;">
                            ${tagHtml}
                            ${shiftTagHtml || node.operator ? `
                                <div class="operator-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                                    ${shiftTagHtml}
                                    ${node.operator ? `<span style="background:rgba(255,255,255,0.06); color:var(--text-secondary); padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:600; white-space:nowrap; border:1px solid rgba(255,255,255,0.08); display:inline-flex; align-items:center; gap:3px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">👤 ${node.operator}</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                return `
                    <div class="timeline-item" ${node.blockId ? `id="${node.blockId}"` : ''}>
                        <div class="timeline-dot"></div>
                        <div class="timeline-content" style="position: relative; background: ${node.bgColor}; transition: transform 0.3s ease; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                            <div class="timeline-info" style="flex: 1; min-width: 0;">
                                <div class="timeline-time">${node.date}</div>
                                <div class="timeline-desc">${node.desc}</div>
                                ${node.loc ? `<div class="timeline-loc" style="font-size:0.75rem; color:var(--primary); margin-top:4px;">📍 ${node.loc}</div>` : ''}
                                ${node.stayDuration ? `<div class="stay-duration ${node.isOver24h ? 'stay-duration-over24h' : ''}" style="font-size:0.75rem; color:${node.isOver24h ? '#ef4444' : 'var(--accent)'}; margin-top:6px; font-weight:600; background:${node.isOver24h ? 'rgba(239,68,68,0.1)' : 'rgba(244,114,182,0.1)'}; display:inline-block; padding:2px 8px; border-radius:4px; ${node.isOver24h ? 'border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 8px rgba(239,68,68,0.2);' : ''}">⏱️ ${node.stayLoc} ${node.stayDuration}${node.isOver24h ? ' <span style="margin-left:4px">⚠️ 滞留超时</span>' : ''}</div>` : ''}
                                ${node.warning ? `<div class="operation-warning" style="font-size:0.75rem; color:#ef4444; margin-top:6px; font-weight:600; background:rgba(239,68,68,0.1); display:inline-block; padding:4px 10px; border-radius:6px; border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 8px rgba(239,68,68,0.15); margin-right:8px;">⚠️ ${node.warning}</div>` : ''}
                                ${nodeAlertsHtml}
                            </div>
                            ${rightContainerHtml}
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
                    ${safetyAlertsHtml}
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
                    loc: node.location || '',
                    operator: node.create_by_name || node.createByName || ''
                });
            });
        }
    });

    let safetyAlerts = [];
    if (allEvents.length > 0) {
        allEvents.forEach((ev) => ev.ts = parseDate(ev.date));
        
        const newestEvent = allEvents[0];
        const latestDesc = newestEvent ? newestEvent.desc : '暂无轨迹';
        const isDelivered = latestDesc.toLowerCase().includes('delivered') || (item.waybill && (item.waybill.exceptionStatusName === '已送达' || item.waybill.exceptionStatusName === '已签收'));
        
        safetyAlerts = analyzeHubSafetyRisks(allEvents, isDelivered);
        
        let lastUnpairedInNode = null;
        let deliveryIndex = -1;
        for (let i = 0; i < allEvents.length; i++) {
            const ev = allEvents[i];
            const desc = (ev.desc || '').toLowerCase();
            if (desc.includes('delivered') || desc.includes('signed') || desc.includes('已签收') || desc.includes('已送达')) {
                deliveryIndex = i;
                break;
            }
        }

        for (let i = allEvents.length - 1; i >= 0; i--) {
            const node = allEvents[i];
            const lowerDesc = (node.desc || '').toLowerCase();
            const isIn = lowerDesc.includes('signed in');
            const isOut = lowerDesc.includes('left sorting center');
            
            if (isIn) {
                if (lastUnpairedInNode) {
                    lastUnpairedInNode.warning = '漏操作风险：签入后无对应签出';
                }
                lastUnpairedInNode = node;
            } else if (isOut) {
                if (lastUnpairedInNode) {
                    lastUnpairedInNode = null;
                } else {
                    node.warning = '漏操作风险：签出前无对应签入';
                }
            }
            
            if (i === deliveryIndex) {
                if (lastUnpairedInNode) {
                    lastUnpairedInNode = null;
                }
            }
        }
        if (lastUnpairedInNode && lastUnpairedInNode !== allEvents[0]) {
            lastUnpairedInNode.warning = '漏操作风险：签入后无对应签出';
        }
    }

    // Modal safety alerts section
    let safetyAlertsHtml = '';
    if (safetyAlerts.length > 0) {
        safetyAlertsHtml = `
            <div class="safety-alerts-wrapper" style="margin: 0 1rem 1.5rem 1rem; padding: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.05); text-align: left;">
                <div style="font-size: 0.85rem; font-weight: 700; color: #f87171; display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    🛡️ SOP 转运运营红线隐患告警 (${safetyAlerts.length} 项)
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${safetyAlerts.map(alert => `
                        <div style="font-size: 0.775rem; line-height: 1.4; color: ${alert.level === 'danger' ? '#f87171' : '#fbbf24'}; display: flex; align-items: flex-start; gap: 6px; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px; border-left: 3px solid ${alert.level === 'danger' ? '#ef4444' : '#fbbf24'};">
                            <span>${alert.message}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Insert safety alerts into detail modal header area
    const modalHeader = elements.modal.querySelector('.modal-header') || elements.modal.querySelector('.card');
    // Ensure any existing safety-alerts-wrapper inside modal is removed first
    const existingAlerts = elements.modal.querySelector('.safety-alerts-wrapper');
    if (existingAlerts) existingAlerts.remove();
    if (safetyAlertsHtml && modalHeader) {
        modalHeader.insertAdjacentHTML('afterend', safetyAlertsHtml);
    }

    elements.timeline.innerHTML = allEvents.map((node, i) => {
        let intervalHtml = '';
        if (i < allEvents.length - 1) {
            const nextNode = allEvents[i + 1];
            if (node.ts > 0 && nextNode.ts > 0) {
                let diffMs = Math.abs(node.ts - nextNode.ts);
                const hoursVal = diffMs / (1000 * 60 * 60);
                let diffHours = hoursVal.toFixed(1);
                if (hoursVal > 24) {
                    intervalHtml = `<div class="timeline-interval" style="color: #f87171; background: rgba(248, 113, 113, 0.15); border: 1px solid rgba(248, 113, 113, 0.3); box-shadow: 0 0 8px rgba(248, 113, 113, 0.15); font-weight: 700;">⚠️ 间隔 ${diffHours} 小时 (操作超时)</div>`;
                } else {
                    intervalHtml = `<div class="timeline-interval">↑ 间隔 ${diffHours} 小时</div>`;
                }
            }
        }
        const tags = [];
        const lowerDesc = (node.desc || '').toLowerCase();
        if (lowerDesc.includes('signed in')) tags.push('<span style="background:rgba(167,139,250,0.15);color:#8b5cf6;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(139,92,246,0.15);">签入</span>');
        if (lowerDesc.includes('left sorting center')) tags.push('<span style="background:rgba(251,146,60,0.15);color:#ea580c;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(234,88,12,0.15);">签出</span>');
        if (lowerDesc.includes('bagging the parcel')) tags.push('<span style="background:rgba(56,189,248,0.15);color:#0ea5e9;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(14,165,233,0.15);">集包</span>');
        if (lowerDesc.includes('left from')) tags.push('<span style="background:rgba(251,191,36,0.15);color:#d97706;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(217,119,6,0.15);">离站</span>');
        const tagHtml = tags.length > 0 ? `<div class="timeline-tags" style="display:flex; flex-direction:column; gap:6px;">${tags.join('')}</div>` : '';

        let shiftTagHtml = '';
        if (lowerDesc.includes('bagging the parcel')) {
            const timePart = (node.date || '').split(' ')[1] || '';
            const hourStr = timePart.split(':')[0] || '';
            const hour = parseInt(hourStr, 10);
            if (!isNaN(hour)) {
                if (hour >= 8 && hour < 20) {
                    shiftTagHtml = `<span style="background:rgba(245,158,11,0.12); color:#f59e0b; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; border:1px solid rgba(245,158,11,0.25); display:inline-flex; align-items:center; gap:2px;">☀️ 早班</span>`;
                } else {
                    shiftTagHtml = `<span style="background:rgba(99,102,241,0.12); color:#818cf8; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700; border:1px solid rgba(99,102,241,0.25); display:inline-flex; align-items:center; gap:2px;">🌙 晚班</span>`;
                }
            }
        }

        // Extract node-specific SOP metrics alerts for the modal
        const nodeAlerts = safetyAlerts.filter(a => a.nodeIndex === i);
        let nodeAlertsHtml = '';
        if (nodeAlerts.length > 0) {
            nodeAlertsHtml = nodeAlerts.map(alert => `
                <div class="operation-warning" style="font-size:0.75rem; color:${alert.level === 'danger' ? '#ef4444' : '#fbbf24'}; margin-top:6px; font-weight:600; background:${alert.level === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)'}; display:inline-block; padding:4px 10px; border-radius:6px; border: 1px solid ${alert.level === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'}; box-shadow: 0 0 8px ${alert.level === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)'}; margin-right:8px;">
                    ${alert.level === 'danger' ? '🚨' : '⚠️'} [SOP ${alert.type}时效红线] ${alert.message.replace(/🚨|⚠️/g, '').trim()}
                </div>
            `).join('');
        }

        // Group action tags and operator/shift tags together on the right side for modal
        let rightContainerHtml = '';
        if (tagHtml || shiftTagHtml || node.operator) {
            rightContainerHtml = `
                <div class="timeline-right" style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; min-width: fit-content; justify-content: center; z-index: 2;">
                    ${tagHtml}
                    ${shiftTagHtml || node.operator ? `
                        <div class="operator-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                            ${shiftTagHtml}
                            ${node.operator ? `<span style="background:rgba(255,255,255,0.06); color:var(--text-secondary); padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:600; white-space:nowrap; border:1px solid rgba(255,255,255,0.08); display:inline-flex; align-items:center; gap:3px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">👤 ${node.operator}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        return `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content" style="position: relative; display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                <div class="timeline-info" style="flex: 1; min-width: 0;">
                    <div class="timeline-time">${node.date}</div>
                    <div class="timeline-desc">${node.desc}</div>
                    ${node.loc ? `<div class="timeline-loc" style="font-size:0.75rem; color:var(--primary); margin-top:4px;">📍 ${node.loc}</div>` : ''}
                    ${node.warning ? `<div class="operation-warning" style="font-size:0.75rem; color:#ef4444; margin-top:6px; font-weight:600; background:rgba(239,68,68,0.1); display:inline-block; padding:4px 10px; border-radius:6px; border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 8px rgba(239,68,68,0.15);">⚠️ ${node.warning}</div>` : ''}
                    ${nodeAlertsHtml}
                </div>
                ${rightContainerHtml}
            </div>
            ${intervalHtml}
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

function updateTodayQueries(increment = false) {
    const today = new Date().toISOString().split('T')[0];
    let storedDate = localStorage.getItem('gtracking_todayDate');
    let queryCount = parseInt(localStorage.getItem('gtracking_queryCount') || '0', 10);

    if (storedDate !== today) {
        queryCount = 0;
        localStorage.setItem('gtracking_todayDate', today);
    }

    if (increment) {
        queryCount++;
        localStorage.setItem('gtracking_queryCount', queryCount);
    }

    const counterEl = document.getElementById('today-queries');
    if (counterEl) {
        counterEl.textContent = queryCount;
    }
}

function exportToCSV() {
    if (!currentResults || currentResults.length === 0) {
        alert('暂无查询结果可导出');
        return;
    }

    // CSV Headers
    const headers = ['运单号', '第三方单号', '当前状态', '轨迹时间', '轨迹描述', '轨迹地点', '操作人', '相邻节点间隔 (小时)', '异常提示'];
    const rows = [headers];

    currentResults.forEach(item => {
        const waybillNo = item.waybill ? (item.waybill.waybillNo || '无') : '无';
        const thirdWaybillNo = item.waybill ? (item.waybill.thirdWaybillNo || '无') : '无';
        const status = item.waybill ? (item.waybill.exceptionStatusName || '进行中') : '未知状态';

        const allEvents = [];
        if (item.list) {
            item.list.forEach(group => {
                if (group.trackList) {
                    group.trackList.forEach(node => {
                        allEvents.push({
                            date: group.operationTime + ' ' + node.operationTime,
                            desc: node.es_context || node.pub_es_context || '',
                            loc: node.location || '',
                            operator: node.create_by_name || node.createByName || ''
                        });
                    });
                }
            });
        }

        if (allEvents.length > 0) {
            allEvents.forEach((ev) => ev.ts = parseDate(ev.date));
            
            let lastUnpairedInNode = null;
            let deliveryIndex = -1;
            for (let i = 0; i < allEvents.length; i++) {
                const ev = allEvents[i];
                const desc = (ev.desc || '').toLowerCase();
                if (desc.includes('delivered') || desc.includes('signed') || desc.includes('已签收') || desc.includes('已送达')) {
                    deliveryIndex = i;
                    break;
                }
            }

            for (let i = allEvents.length - 1; i >= 0; i--) {
                const node = allEvents[i];
                const lowerDesc = (node.desc || '').toLowerCase();
                const isIn = lowerDesc.includes('signed in');
                const isOut = lowerDesc.includes('left sorting center');
                
                if (isIn) {
                    if (lastUnpairedInNode) {
                        lastUnpairedInNode.warning = '漏操作风险：签入后无对应签出';
                    }
                    lastUnpairedInNode = node;
                } else if (isOut) {
                    if (lastUnpairedInNode) {
                        lastUnpairedInNode = null;
                    } else {
                        node.warning = '漏操作风险：签出前无对应签入';
                    }
                }
                
                if (i === deliveryIndex) {
                    if (lastUnpairedInNode) {
                        lastUnpairedInNode = null;
                    }
                }
            }
            if (lastUnpairedInNode && lastUnpairedInNode !== allEvents[0]) {
                lastUnpairedInNode.warning = '漏操作风险：签入后无对应签出';
            }
        }

        if (allEvents.length === 0) {
            rows.push([waybillNo, thirdWaybillNo, status, '暂无轨迹', '', '', '', '', '']);
        } else {
            allEvents.forEach((node, i) => {
                let intervalStr = '';
                if (i < allEvents.length - 1) {
                    const nextNode = allEvents[i + 1];
                    if (node.ts > 0 && nextNode.ts > 0) {
                        let diffMs = Math.abs(node.ts - nextNode.ts);
                        const hoursVal = diffMs / (1000 * 60 * 60);
                        intervalStr = hoursVal.toFixed(1);
                    }
                }
                rows.push([
                    waybillNo,
                    thirdWaybillNo,
                    status,
                    node.date,
                    node.desc,
                    node.loc,
                    node.operator || '',
                    intervalStr,
                    node.warning || ''
                ]);
            });
        }
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
    link.setAttribute('download', `Gtracking_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
