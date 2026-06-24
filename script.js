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
    initBagPackModal();
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
            updateTodayQueries(true);
            renderResults(combinedData);
        } else {
            showError('查询失败，接口无有效返回');
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

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Extract 袋牌号 from bagging track description (BG… or B+digit…). */
function extractBagLabelNo(desc) {
    if (!desc || !/bagging/i.test(desc)) return null;
    const m = desc.match(/\b(BG[A-Za-z0-9-]+|B\d[A-Za-z0-9-]*)\b/i);
    return m ? m[1] : null;
}

function formatBaggingDesc(desc, eventDate) {
    const label = extractBagLabelNo(desc);
    if (!label) return escapeHtml(desc);
    const idx = desc.indexOf(label);
    if (idx === -1) return escapeHtml(desc);
    const before = escapeHtml(desc.slice(0, idx));
    const after = escapeHtml(desc.slice(idx + label.length));
    const safeLabel = escapeHtml(label);
    const safeDate = escapeHtml(eventDate || '');
    const link = `<a href="#" class="bag-label-link" data-package-no="${safeLabel}" data-event-date="${safeDate}" title="查看 DMS 集包记录">${safeLabel}</a>`;
    return before + link + after;
}

function formatPackDateYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildPackQueryRanges(eventDate) {
    const ts = parseDate(eventDate);
    const base = ts > 0 ? new Date(ts) : new Date();
    const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const sameDay = formatPackDateYmd(dayStart);
    const ranges = [{
        beginTime: `${sameDay} 00:00:00`,
        endTime: `${sameDay} 23:59:59`
    }];
    const wideStart = new Date(dayStart);
    wideStart.setDate(wideStart.getDate() - 30);
    const wideEnd = new Date(dayStart);
    wideEnd.setDate(wideEnd.getDate() + 1);
    ranges.push({
        beginTime: `${formatPackDateYmd(wideStart)} 00:00:00`,
        endTime: `${formatPackDateYmd(wideEnd)} 23:59:59`
    });
    return ranges;
}

function getPackRows(apiData) {
    if (!apiData) return [];
    if (Array.isArray(apiData.rows)) return apiData.rows;
    if (apiData.data) {
        if (Array.isArray(apiData.data)) return apiData.data;
        if (Array.isArray(apiData.data.rows)) return apiData.data.rows;
        if (Array.isArray(apiData.data.list)) return apiData.data.list;
    }
    return [];
}

function pickPackStatus(row, pick) {
    const label = pick(
        'departedName',
        'siteStatus',
        'packageTypeName',
        'typeName',
        'statusName',
        'packageStatusName',
        'statusStr',
        'departedStatusName'
    );
    if (label) return label;
    const code = row.departed ?? row.departedStatus ?? row.status;
    if (code !== undefined && code !== null && String(code).trim() !== '') {
        return String(code);
    }
    return '';
}

function mapPackRecord(row) {
    if (!row) return null;
    const pick = (...keys) => {
        for (const k of keys) {
            const v = row[k];
            if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
    };
    return {
        packageNo: pick('packageNo', 'hubPackageNo', 'bagNo', 'package_no'),
        originOrg: pick(
            'startCenterName', 'deptName', 'currentCenterName',
            'startOrgName', 'sendOrgName', 'originOrgName',
            'departOrgName', 'startDeptName', 'sendCenterName', 'originCenterName',
            'departCenterName', 'sendCenter', 'startOrganization', 'originOrganization'
        ),
        destOrg: pick(
            'destinCenterName', 'destinName', 'destinCenterId',
            'endOrgName', 'endCenterName', 'targetOrgName', 'destOrgName',
            'arriveOrgName', 'endDeptName', 'receiveOrgName', 'destCenterName',
            'arriveCenterName', 'receiveCenterName', 'targetCenterName', 'endOrganization'
        ),
        signInTime: pick(
            'checkInTime', 'optCheckInTime', 'signInTime', 'checkTime',
            'signTime', 'checkinTime', 'createTime', 'updateTime', 'operationTime'
        ),
        status: pickPackStatus(row, pick),
        operator: pick(
            'createByName', 'operatorName', 'createBy', 'updateByName', 'operator'
        )
    };
}

async function fetchCenterPackList(packageNo, eventDate) {
    const ranges = buildPackQueryRanges(eventDate);
    let lastPayload = null;
    for (const range of ranges) {
        const res = await fetch(getApiBase() + '/api/center-pack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pageNum: 1,
                pageSize: 20,
                packageNoList: [packageNo],
                departedList: [],
                beginTime: range.beginTime,
                endTime: range.endTime
            })
        });
        const data = await res.json();
        lastPayload = data;
        if (!res.ok) {
            throw new Error(data.msg || data.error || `HTTP ${res.status}`);
        }
        if (data.code !== undefined && data.code !== 200) {
            throw new Error(data.msg || '集包查询失败');
        }
        const rows = getPackRows(data);
        const exact = rows.filter(r => {
            const no = (r.packageNo || r.hubPackageNo || '').toString();
            return no.toUpperCase() === packageNo.toUpperCase();
        });
        if (exact.length > 0) return exact;
        if (rows.length > 0) return rows;
    }
    return getPackRows(lastPayload);
}

function renderPackDetailHtml(packageNo, rows) {
    if (!rows || rows.length === 0) {
        return `<div class="pack-empty">未在 DMS 中找到袋牌号 <strong>${escapeHtml(packageNo)}</strong> 的集包记录</div>`;
    }
    return rows.map((row, i) => {
        const m = mapPackRecord(row);
        const title = rows.length > 1 ? `记录 ${i + 1}` : '集包信息';
        return `
            <section class="pack-detail-section" style="${i > 0 ? 'margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border);' : ''}">
                ${rows.length > 1 ? `<h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;">${title}</h4>` : ''}
                <dl class="pack-detail-grid">
                    <dt>袋牌号</dt><dd>${escapeHtml(m.packageNo || packageNo)}</dd>
                    <dt>始发组织</dt><dd>${escapeHtml(m.originOrg || '—')}</dd>
                    <dt>目的组织</dt><dd>${escapeHtml(m.destOrg || '—')}</dd>
                    <dt>签入时间</dt><dd>${escapeHtml(m.signInTime || '—')}</dd>
                    <dt>状态</dt><dd>${escapeHtml(String(m.status || '—'))}</dd>
                    <dt>操作人</dt><dd>${escapeHtml(m.operator || '—')}</dd>
                </dl>
            </section>
        `;
    }).join('');
}

async function openBagPackModal(packageNo, eventDate) {
    const modal = document.getElementById('pack-modal');
    const body = document.getElementById('pack-modal-body');
    const title = document.getElementById('pack-modal-title');
    if (!modal || !body) return;

    title.textContent = `集包记录 · ${packageNo}`;
    body.innerHTML = '<div class="pack-loading"><span class="loader" style="display:inline-block;width:28px;height:28px;margin-bottom:0.75rem;"></span><br>正在查询 DMS 集包记录...</div>';
    modal.classList.remove('hidden');

    try {
        const rows = await fetchCenterPackList(packageNo, eventDate);
        body.innerHTML = renderPackDetailHtml(packageNo, rows);
    } catch (e) {
        console.error('Center pack query failed:', e);
        body.innerHTML = `<div class="pack-error">查询失败：${escapeHtml(e.message || String(e))}<br><span style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;display:block;">请确认已登录 DMS 并保存 Token</span></div>`;
    }
}

function initBagPackModal() {
    const modal = document.getElementById('pack-modal');
    const closeBtn = document.getElementById('close-pack-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    }
    document.addEventListener('click', (e) => {
        const link = e.target.closest('.bag-label-link');
        if (!link) return;
        e.preventDefault();
        const packageNo = link.getAttribute('data-package-no');
        const eventDate = link.getAttribute('data-event-date') || '';
        if (packageNo) openBagPackModal(packageNo, eventDate);
    });
}

function isOrderLabelEvent(ev) {
    if (!ev || !ev.desc) return false;
    const d = ev.desc.toLowerCase();
    return d.includes('gets the order') ||
        d.includes('label created') ||
        ev.desc.includes('创建面单') ||
        ev.desc.includes('获取订单信息');
}

function isSignInEvent(ev) {
    if (!ev || !ev.desc) return false;
    const d = ev.desc.toLowerCase();
    return d.includes('signed in') ||
        d.includes('arrived at gofo') ||
        ev.desc.includes('转运中心签入') ||
        ev.desc.includes('网点签入') ||
        ev.corto === '201' || ev.corto === '202' ||
        ev.operation_move === '201' || ev.operation_move === '202';
}

/** 末端站点签入（Signed in at station），不参与无签出提醒 */
function isStationSignInEvent(ev) {
    if (!ev || !ev.desc) return false;
    return ev.desc.toLowerCase().includes('signed in at station');
}

/** 分段审计起点：GOFO gets the order 之后的首次 sign in */
function getSegmentAuditStartEvent(events) {
    if (!events || events.length === 0) return null;
    const chrono = [...events].sort((a, b) => a.ts - b.ts);
    const labelEvent = chrono.find(isOrderLabelEvent);
    const afterLabelTs = labelEvent && labelEvent.ts > 0 ? labelEvent.ts : -1;
    const firstSignInAfterLabel = chrono.find(
        e => isSignInEvent(e) && e.ts > 0 && (afterLabelTs < 0 || e.ts > afterLabelTs)
    );
    if (firstSignInAfterLabel) return firstSignInAfterLabel;
    return chrono.find(e => isSignInEvent(e) && e.ts > 0) || null;
}

function effectiveSegmentStartTs(firstNodeTs, lastNodeTs, auditStartTs) {
    if (!auditStartTs || auditStartTs <= 0) return firstNodeTs;
    if (!lastNodeTs || lastNodeTs < auditStartTs) return null;
    if (!firstNodeTs || firstNodeTs < auditStartTs) return auditStartTs;
    return firstNodeTs;
}

function formatDurationMs(ms) {
    if (!ms || ms <= 0) return '';
    const diffHours = ms / (1000 * 60 * 60);
    const days = Math.floor(diffHours / 24);
    const hours = (diffHours % 24).toFixed(1);
    return days > 0 ? `${days}天 ${hours}小时` : `${diffHours.toFixed(1)}小时`;
}

/** 相邻节点时间间隔（首次 sign in 之前的区间不显示） */
function buildTimelineIntervalHtml(node, nextNode, firstSignInTs) {
    if (!node || !nextNode) return '';
    if (firstSignInTs > 0) {
        if (nextNode.ts > 0 && nextNode.ts < firstSignInTs) return '';
        if (node.ts > 0 && node.ts < firstSignInTs) return '';
    }
    if (!(node.ts > 0 && nextNode.ts > 0)) return '';
    const diffMs = Math.abs(node.ts - nextNode.ts);
    const hoursVal = diffMs / (1000 * 60 * 60);
    const diffHours = hoursVal.toFixed(1);
    if (hoursVal > 24) {
        return `<div class="timeline-interval" style="color: #f87171; background: rgba(248, 113, 113, 0.15); border: 1px solid rgba(248, 113, 113, 0.3); box-shadow: 0 0 8px rgba(248, 113, 113, 0.15); font-weight: 700;">⚠️ 间隔 ${diffHours} 小时 (操作超时)</div>`;
    }
    return `<div class="timeline-interval">↑ 间隔 ${diffHours} 小时</div>`;
}

const ALERT_LEVEL_RANK = { danger: 3, warning: 2, info: 1 };

/** 同规则同站点仅保留最高级别告警 */
function dedupeSafetyAlerts(alerts) {
    if (!alerts || alerts.length === 0) return [];
    const best = new Map();
    for (const alert of alerts) {
        const key = `${alert.type}|${alert.loc || ''}`;
        const existing = best.get(key);
        if (!existing || (ALERT_LEVEL_RANK[alert.level] || 0) > (ALERT_LEVEL_RANK[existing.level] || 0)) {
            best.set(key, alert);
        }
    }
    return [...best.values()];
}

function sortSafetyAlerts(alerts) {
    const typeOrder = { '断更': 0, '卸车': 1, '操作': 2, '分拣': 3, '漏操作': 4, '间隔': 5 };
    return [...alerts].sort((a, b) => {
        const levelDiff = (ALERT_LEVEL_RANK[b.level] || 0) - (ALERT_LEVEL_RANK[a.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
    });
}

function eventSiteMatches(ev, loc) {
    if (!loc) return true;
    const site = getEventSiteKey(ev) || (ev.loc || '').trim();
    return site === loc;
}

function renderSafetyAlertsHtml(alerts, marginStyle) {
    if (!alerts || alerts.length === 0) return '';
    const wrapperMargin = marginStyle || 'margin-top: 10px';
    const dangerCount = alerts.filter(a => a.level === 'danger').length;
    const summaryHint = dangerCount > 0
        ? `<span style="font-size:0.7rem;color:#f87171;font-weight:600;margin-left:4px;">含 ${dangerCount} 项红线</span>`
        : '';
    return `
        <div class="safety-alerts-wrapper" style="${wrapperMargin}; padding: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.05); text-align: left;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #f87171; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                🛡️ 风险提醒告警 (${alerts.length} 项)${summaryHint}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${alerts.map(alert => `
                    <div style="font-size: 0.775rem; line-height: 1.4; color: ${alert.level === 'danger' ? '#f87171' : '#fbbf24'}; display: flex; align-items: flex-start; gap: 6px; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px; border-left: 3px solid ${alert.level === 'danger' ? '#ef4444' : '#fbbf24'};">
                        <span>${alert.message}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function isSignOutEvent(ev) {
    if (!ev || !ev.desc) return false;
    const d = ev.desc.toLowerCase();
    return d.includes('left sorting center') ||
        ev.corto === '200' || ev.operation_move === '200';
}

/** 从 location 或轨迹描述解析站点编码（如 MIA.H、SJU01） */
function getEventSiteKey(node) {
    const loc = (node.loc || '').trim();
    if (loc && loc !== 'EMPTY') return loc;
    const d = node.desc || '';
    const patterns = [
        /signed in at sorting center\s+([A-Za-z0-9.-]+)/i,
        /signed in at station\s+([A-Za-z0-9.-]+)/i,
        /left sorting center\s+([A-Za-z0-9.-]+)/i,
        /signed in at\s+([A-Za-z0-9.-]+)/i
    ];
    for (const re of patterns) {
        const m = d.match(re);
        if (m && m[1]) return m[1].trim();
    }
    return loc;
}

function isDeliveryEvent(ev) {
    if (!ev || !ev.desc) return false;
    const d = ev.desc.toLowerCase();
    return d.includes('delivered') ||
        d.includes('已签收') ||
        d.includes('已送达');
}

/** 按站点配对签入/签出：同站可多次签入，只要该站有过一次签出则不再提示无签出 */
function markSignInOutPairingBySite(allEvents) {
    if (!allEvents || allEvents.length === 0) return;
    const chrono = [...allEvents].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const siteSignIns = new Map();
    const siteHasSignOut = new Set();

    for (const node of chrono) {
        const loc = getEventSiteKey(node);
        if (!loc || loc === 'EMPTY') continue;

        if (isSignInEvent(node) && !isStationSignInEvent(node)) {
            if (!siteSignIns.has(loc)) siteSignIns.set(loc, []);
            siteSignIns.get(loc).push(node);
        } else if (isSignOutEvent(node)) {
            siteHasSignOut.add(getEventSiteKey(node) || loc);
        }
    }

    for (const node of chrono) {
        const loc = getEventSiteKey(node);
        if (!loc || loc === 'EMPTY' || !isSignOutEvent(node)) continue;
        const outLoc = getEventSiteKey(node) || loc;
        const signIns = siteSignIns.get(outLoc);
        if (!signIns || signIns.length === 0) {
            node.warning = node.warning || '漏操作风险：本站点签出前无对应签入';
        }
    }

    for (const [loc, signIns] of siteSignIns) {
        if (siteHasSignOut.has(loc)) continue;
        for (const node of signIns) {
            node.missingSignOutAtSite = true;
            node.warning = node.warning || '漏操作风险：本站点签入后无对应签出';
        }
    }
}

function renderSignInTag(node) {
    const signInBadge = '<span style="background:rgba(167,139,250,0.15);color:#8b5cf6;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(139,92,246,0.15);">签入</span>';
    if (!node.missingSignOutAtSite) return signInBadge;
    const locTitle = node.loc ? `站点 ${node.loc}：` : '';
    return `<div class="signin-tag-row" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        ${signInBadge}
        <span class="signin-missing-out-badge" title="${locTitle}签入后未见签出扫描">⚠️ 无签出</span>
    </div>`;
}

function buildTimelineActionTags(node) {
    const tags = [];
    const lowerDesc = (node.desc || '').toLowerCase();
    if (isSignInEvent(node) || lowerDesc.includes('signed in')) {
        tags.push(renderSignInTag(node));
    }
    if (isSignOutEvent(node) || lowerDesc.includes('left sorting center')) {
        tags.push('<span style="background:rgba(251,146,60,0.15);color:#ea580c;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(234,88,12,0.15);">签出</span>');
    }
    if (lowerDesc.includes('bagging the parcel')) {
        tags.push('<span style="background:rgba(56,189,248,0.15);color:#0ea5e9;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(14,165,233,0.15);">集包</span>');
    }
    if (lowerDesc.includes('left from')) {
        tags.push('<span style="background:rgba(251,191,36,0.15);color:#d97706;padding:4px 10px;border-radius:6px;font-size:1rem;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(217,119,6,0.15);">离站</span>');
    }
    return tags;
}

// SOP 转运核心指标及安全/运营隐患分析引擎 (Based on hub_metrics_formulas.pdf)
function analyzeHubSafetyRisks(allEvents, isDelivered) {
    const alerts = [];
    if (!allEvents || allEvents.length === 0) return alerts;

    const chronoEvents = [...allEvents].sort((a, b) => a.ts - b.ts);

    // SOP-3: 卸车签入及时率 — 车辆抵达后 2H 内须完成物理签入
    for (const ev of chronoEvents) {
        const lowerDesc = (ev.desc || '').toLowerCase();
        const isArrival = lowerDesc.includes('vehicle arrived') ||
            lowerDesc.includes('vehicle has arrived') ||
            lowerDesc.includes('arrived at') ||
            ev.corto === '412' || ev.corto === '415' ||
            ev.operation_move === '412' || ev.operation_move === '415';
        if (!isArrival) continue;

        const loc = getEventSiteKey(ev) || ev.loc || '未知站点';
        const signin = chronoEvents.find(e => e.ts >= ev.ts && e !== ev && eventSiteMatches(e, loc) && isSignInEvent(e));
        if (signin) {
            const diffHours = (signin.ts - ev.ts) / 3600000;
            if (diffHours > 2) {
                alerts.push({
                    type: '卸车',
                    level: 'danger',
                    loc,
                    message: `🚨 [SOP-3 卸车签入] ${loc}：车辆抵达后 ${diffHours.toFixed(1)} 小时才完成签入（红线 2 小时）`
                });
            }
        } else if (!isDelivered && ev.ts > 0) {
            const diffHours = (Date.now() - ev.ts) / 3600000;
            if (diffHours > 2) {
                alerts.push({
                    type: '卸车',
                    level: 'danger',
                    loc,
                    message: `🚨 [SOP-3 卸车签入] ${loc}：车辆抵达已 ${diffHours.toFixed(1)} 小时，仍未完成卸车签入`
                });
            }
        }
    }

    // SOP-2: HUB 分拣及时率 — 签入后 2H 内须完成集包
    for (const ev of chronoEvents) {
        if (!isSignInEvent(ev) || isStationSignInEvent(ev)) continue;
        const loc = getEventSiteKey(ev) || ev.loc || '未知站点';
        const bagging = chronoEvents.find(e => e.ts >= ev.ts && eventSiteMatches(e, loc) && (
            (e.desc || '').toLowerCase().includes('bagging') ||
            e.corto === '217' || e.operation_move === '217'
        ));
        if (bagging) {
            const diffHours = (bagging.ts - ev.ts) / 3600000;
            if (diffHours > 2) {
                alerts.push({
                    type: '分拣',
                    level: 'warning',
                    loc,
                    message: `⚠️ [SOP-2 分拣集包] ${loc}：签入到集包历时 ${diffHours.toFixed(1)} 小时（标准 90–120 分钟）`
                });
            }
        } else if (!isDelivered && ev.ts > 0) {
            const diffHours = (Date.now() - ev.ts) / 3600000;
            if (diffHours > 2) {
                alerts.push({
                    type: '分拣',
                    level: 'warning',
                    loc,
                    message: `⚠️ [SOP-2 分拣集包] ${loc}：已签入 ${diffHours.toFixed(1)} 小时，尚未集包建包`
                });
            }
        }
    }

    // SOP-4: HUB 操作及时率 — 场地停留不得超过 24H
    for (const ev of chronoEvents) {
        const lowerDesc = (ev.desc || '').toLowerCase();
        if (!isSignInEvent(ev) && !lowerDesc.includes('arrived')) continue;
        const loc = getEventSiteKey(ev) || ev.loc || '未知站点';
        const checkout = chronoEvents.find(e => e.ts >= ev.ts && eventSiteMatches(e, loc) && (
            (e.desc || '').toLowerCase().includes('left') ||
            (e.desc || '').toLowerCase().includes('departed') ||
            e.corto === '200' || e.corto === '411' ||
            e.operation_move === '200' || e.operation_move === '411'
        ));
        if (checkout) {
            const diffHours = (checkout.ts - ev.ts) / 3600000;
            if (diffHours > 24) {
                alerts.push({
                    type: '操作',
                    level: 'warning',
                    loc,
                    message: `⚠️ [SOP-4 场地滞留] ${loc}：停留 ${diffHours.toFixed(1)} 小时才离港（红线 24 小时）`
                });
            }
        } else if (!isDelivered && ev.ts > 0) {
            const diffHours = (Date.now() - ev.ts) / 3600000;
            if (diffHours > 24) {
                alerts.push({
                    type: '操作',
                    level: 'warning',
                    loc,
                    message: `⚠️ [SOP-4 场地滞留] ${loc}：已滞留 ${diffHours.toFixed(1)} 小时，未见发车/离港扫描`
                });
            }
        }
    }

    // SOP-7: 内部断更 — 24H / 48H / 120H 渐进告警
    if (!isDelivered && allEvents[0] && allEvents[0].ts > 0) {
        const newestEvent = allEvents[0];
        const idleLoc = getEventSiteKey(newestEvent) || newestEvent.loc || '转运环节';
        const idleHours = (Date.now() - newestEvent.ts) / 3600000;
        if (idleHours > 120) {
            alerts.push({
                type: '断更',
                level: 'danger',
                loc: idleLoc,
                message: `🚨 [SOP-7 断更红线] 已连续断更 ${idleHours.toFixed(1)} 小时（超 5 天），存在丢失或死仓隐患`
            });
        } else if (idleHours > 48) {
            alerts.push({
                type: '断更',
                level: 'danger',
                loc: idleLoc,
                message: `🚨 [SOP-7 重度断更] 在 ${idleLoc} 已连续 ${idleHours.toFixed(1)} 小时无更新，请立即核查实物`
            });
        } else if (idleHours > 24) {
            alerts.push({
                type: '断更',
                level: 'warning',
                loc: idleLoc,
                message: `⚠️ [SOP-7 中度断更] 已连续 ${idleHours.toFixed(1)} 小时无轨迹更新，请保持关注`
            });
        }
    }

    return alerts;
}

/** 签入/签出漏操作风险（按站点汇总） */
function analyzeSignInOutRisks(allEvents) {
    const alerts = [];
    if (!allEvents || allEvents.length === 0) return alerts;

    const chrono = [...allEvents].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const siteSignIns = new Map();
    const siteHasSignOut = new Set();

    for (const node of chrono) {
        const loc = getEventSiteKey(node);
        if (!loc || loc === 'EMPTY') continue;
        if (isSignInEvent(node) && !isStationSignInEvent(node)) {
            if (!siteSignIns.has(loc)) siteSignIns.set(loc, []);
            siteSignIns.get(loc).push(node);
        } else if (isSignOutEvent(node)) {
            siteHasSignOut.add(getEventSiteKey(node) || loc);
        }
    }

    for (const [loc, signIns] of siteSignIns) {
        if (siteHasSignOut.has(loc)) continue;
        alerts.push({
            type: '漏操作',
            level: 'warning',
            loc,
            message: `⚠️ [漏操作] ${loc}：分拣中心签入后未见签出扫描`
        });
    }

    for (const node of chrono) {
        const loc = getEventSiteKey(node);
        if (!loc || loc === 'EMPTY' || !isSignOutEvent(node)) continue;
        const signIns = siteSignIns.get(getEventSiteKey(node) || loc);
        if (!signIns || signIns.length === 0) {
            alerts.push({
                type: '漏操作',
                level: 'warning',
                loc,
                message: `⚠️ [漏操作] ${loc}：签出前无对应分拣中心签入记录`
            });
        }
    }

    return alerts;
}

/** 相邻节点间隔超时（>24H，汇总展示） */
function analyzeIntervalRisks(allEvents, auditStartTs) {
    if (!allEvents || allEvents.length < 2) return [];

    const over24 = [];
    for (let i = 0; i < allEvents.length - 1; i++) {
        const node = allEvents[i];
        const nextNode = allEvents[i + 1];
        if (auditStartTs > 0) {
            if (nextNode.ts > 0 && nextNode.ts < auditStartTs) continue;
            if (node.ts > 0 && node.ts < auditStartTs) continue;
        }
        if (!(node.ts > 0 && nextNode.ts > 0)) continue;
        const hoursVal = Math.abs(node.ts - nextNode.ts) / 3600000;
        if (hoursVal > 24) over24.push(hoursVal);
    }

    if (over24.length === 0) return [];
    const maxHours = Math.max(...over24);
    return [{
        type: '间隔',
        level: maxHours > 48 ? 'danger' : 'warning',
        loc: '',
        message: `⚠️ [操作间隔] 轨迹中有 ${over24.length} 处相邻节点间隔超过 24 小时（最长 ${maxHours.toFixed(1)} 小时）`
    }];
}

/** 汇总全部风险规则告警（卡片级展示） */
function collectRiskAlerts(allEvents, isDelivered) {
    if (!allEvents || allEvents.length === 0) return [];
    markSignInOutPairingBySite(allEvents);
    const auditStartEvent = getSegmentAuditStartEvent(allEvents);
    const auditStartTs = auditStartEvent && auditStartEvent.ts > 0 ? auditStartEvent.ts : 0;
    const alerts = [
        ...analyzeHubSafetyRisks(allEvents, isDelivered),
        ...analyzeSignInOutRisks(allEvents),
        ...analyzeIntervalRisks(allEvents, auditStartTs)
    ];
    return sortSafetyAlerts(dedupeSafetyAlerts(alerts));
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
                            operator: node.create_by_name || node.createByName || '',
                            corto: String(node.corto || node.operation_move || ''),
                            operation_move: String(node.operation_move || '')
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
            const auditStartEvent = getSegmentAuditStartEvent(allEvents);
            const auditStartTs = auditStartEvent && auditStartEvent.ts > 0 ? auditStartEvent.ts : 0;
            latestDesc = newestEvent ? newestEvent.desc : '暂无轨迹';
            const isDelivered = latestDesc.toLowerCase().includes('delivered') || status === '已送达' || status === '已签收';
            statusClass = isDelivered ? 'latest-status-delivered' : 'latest-status-pending';
            const deliveredEvent = allEvents.find(ev => ev.desc && ev.desc.toLowerCase().includes('delivered'));

            safetyAlerts = collectRiskAlerts(allEvents, isDelivered);
            safetyAlertsHtml = renderSafetyAlertsHtml(safetyAlerts);
            
            let globalDiffMs = 0;
            const segmentStartTs = auditStartTs;
            if (deliveredEvent) {
                status = '已送达';
                globalDiffMs = deliveredEvent.ts > 0 && segmentStartTs > 0 ? deliveredEvent.ts - segmentStartTs : 0;
            } else if (segmentStartTs > 0) {
                globalDiffMs = Date.now() - segmentStartTs;
            }

            if (globalDiffMs > 0) {
                const durationStr = formatDurationMs(globalDiffMs);
                const auditHint = auditStartTs > 0 ? ' (自首次签入)' : '';
                
                if (deliveredEvent) {
                    totalDurationHtml = `<span class="status-badge" style="background: rgba(74, 222, 128, 0.15); color: var(--success); margin-left: 0.5rem;">总历时: ${durationStr}${auditHint}</span>`;
                } else {
                    totalDurationHtml = `<span class="status-badge" style="background: rgba(251, 191, 36, 0.15); color: var(--warning); margin-left: 0.5rem;">已历时: ${durationStr}${auditHint}</span>`;
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
                    block[block.length - 1].blockId = blockId;
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
                        const startTs = effectiveSegmentStartTs(firstNode.ts, Date.now(), auditStartTs);
                        if (startTs) stayDuration = Date.now() - startTs;
                    } else if (lastNode.ts > 0 && firstNode.ts > 0 && lastNode.ts >= firstNode.ts) {
                        const startTs = effectiveSegmentStartTs(firstNode.ts, lastNode.ts, auditStartTs);
                        if (startTs) stayDuration = lastNode.ts - startTs;
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
                const intervalHtml = i < allEvents.length - 1
                    ? buildTimelineIntervalHtml(node, allEvents[i + 1], auditStartTs)
                    : '';
                const lowerDesc = (node.desc || '').toLowerCase();
                const tags = buildTimelineActionTags(node);
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
                                <div class="timeline-desc">${formatBaggingDesc(node.desc, node.date)}</div>
                                ${node.loc ? `<div class="timeline-loc" style="font-size:0.75rem; color:var(--primary); margin-top:4px;">📍 ${node.loc}</div>` : ''}
                                ${node.missingSignOutAtSite ? `<div class="signin-missing-out-inline">⚠️ ${getEventSiteKey(node) || node.loc || '本站点'}：签入后无签出</div>` : ''}
                                ${node.warning && !node.missingSignOutAtSite ? `<div class="operation-warning" style="font-size:0.75rem; color:#ef4444; margin-top:6px; font-weight:600; background:rgba(239,68,68,0.1); display:inline-block; padding:4px 10px; border-radius:6px; border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 8px rgba(239,68,68,0.15); margin-right:8px;">⚠️ ${node.warning}</div>` : ''}
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
                    operator: node.create_by_name || node.createByName || '',
                    corto: String(node.corto || node.operation_move || ''),
                    operation_move: String(node.operation_move || '')
                });
            });
        }
    });

    let safetyAlerts = [];
    let auditStartTs = 0;
    if (allEvents.length > 0) {
        allEvents.forEach((ev) => ev.ts = parseDate(ev.date));
        
        const newestEvent = allEvents[0];
        const latestDesc = newestEvent ? newestEvent.desc : '暂无轨迹';
        const isDelivered = latestDesc.toLowerCase().includes('delivered') || (item.waybill && (item.waybill.exceptionStatusName === '已送达' || item.waybill.exceptionStatusName === '已签收'));
        const auditStartEvent = getSegmentAuditStartEvent(allEvents);
        auditStartTs = auditStartEvent && auditStartEvent.ts > 0 ? auditStartEvent.ts : 0;
        
        safetyAlerts = collectRiskAlerts(allEvents, isDelivered);
    }

    const safetyAlertsHtml = renderSafetyAlertsHtml(safetyAlerts, 'margin: 0 1rem 1.5rem 1rem');

    // Insert safety alerts into detail modal header area
    const modalHeader = elements.modal.querySelector('.modal-header') || elements.modal.querySelector('.card');
    // Ensure any existing safety-alerts-wrapper inside modal is removed first
    const existingAlerts = elements.modal.querySelector('.safety-alerts-wrapper');
    if (existingAlerts) existingAlerts.remove();
    if (safetyAlertsHtml && modalHeader) {
        modalHeader.insertAdjacentHTML('afterend', safetyAlertsHtml);
    }

    elements.timeline.innerHTML = allEvents.map((node, i) => {
        const intervalHtml = i < allEvents.length - 1
            ? buildTimelineIntervalHtml(node, allEvents[i + 1], auditStartTs)
            : '';
        const lowerDesc = (node.desc || '').toLowerCase();
        const tags = buildTimelineActionTags(node);
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
                    <div class="timeline-desc">${formatBaggingDesc(node.desc, node.date)}</div>
                    ${node.loc ? `<div class="timeline-loc" style="font-size:0.75rem; color:var(--primary); margin-top:4px;">📍 ${node.loc}</div>` : ''}
                    ${node.missingSignOutAtSite ? `<div class="signin-missing-out-inline">⚠️ ${getEventSiteKey(node) || node.loc || '本站点'}：签入后无签出</div>` : ''}
                    ${node.warning && !node.missingSignOutAtSite ? `<div class="operation-warning" style="font-size:0.75rem; color:#ef4444; margin-top:6px; font-weight:600; background:rgba(239,68,68,0.1); display:inline-block; padding:4px 10px; border-radius:6px; border: 1px solid rgba(239,68,68,0.3); box-shadow: 0 0 8px rgba(239,68,68,0.15);">⚠️ ${node.warning}</div>` : ''}
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
    const packModal = document.getElementById('pack-modal');
    if (packModal && event.target === packModal) packModal.classList.add('hidden');
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
        const res = await fetch(`${getApiBase()}/api/17track?waybill=${encodeURIComponent(waybillNo)}`);
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
                            operator: node.create_by_name || node.createByName || '',
                            corto: String(node.corto || node.operation_move || ''),
                            operation_move: String(node.operation_move || '')
                        });
                    });
                }
            });
        }

        let exportAuditStartTs = 0;
        if (allEvents.length > 0) {
            allEvents.forEach((ev) => ev.ts = parseDate(ev.date));
            const auditStartEvent = getSegmentAuditStartEvent(allEvents);
            exportAuditStartTs = auditStartEvent && auditStartEvent.ts > 0 ? auditStartEvent.ts : 0;
            markSignInOutPairingBySite(allEvents);
        }

        if (allEvents.length === 0) {
            rows.push([waybillNo, thirdWaybillNo, status, '暂无轨迹', '', '', '', '', '']);
        } else {
            allEvents.forEach((node, i) => {
                let intervalStr = '';
                if (i < allEvents.length - 1) {
                    const nextNode = allEvents[i + 1];
                    const intervalHtml = buildTimelineIntervalHtml(node, nextNode, exportAuditStartTs);
                    if (intervalHtml && node.ts > 0 && nextNode.ts > 0) {
                        intervalStr = (Math.abs(node.ts - nextNode.ts) / (1000 * 60 * 60)).toFixed(1);
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
                    node.warning || (node.missingSignOutAtSite ? '本站点签入后无签出' : '')
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
