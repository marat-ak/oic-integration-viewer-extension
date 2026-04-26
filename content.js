(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────────────────── */
  var overlay = null;
  var blueprintData = null;
  var currentTheme = 'light';
  var colorOverrides = {};   // { themeName: { TYPE: '#hex', ... } }
  var maxXpathCharsInPreview = 60;
  var currentCode = null;
  var currentVersion = null;

  /* ── Constants ─────────────────────────────────────────────────────── */

  var THEMES = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'high-contrast', label: 'High Contrast' },
    { id: 'solarized', label: 'Solarized' }
  ];

  // Default badge colors per theme per activity type
  var DEFAULT_COLORS = {
    light: {
      RECEIVE: '#2563eb',
      INVOKE: '#1d4ed8',
      REPLY: '#3b82f6',
      TRANSFORMER: '#7c3aed',
      ASSIGNMENT: '#6b7280',
      ROUTER: '#ea580c',
      ROUTER_ROUTE: '#f97316',
      TRY: '#d97706',
      GLOBAL_TRY: '#d97706',
      CATCH_ALL: '#dc2626',
      TRY_CATCH: '#dc2626',
      THROW: '#b91c1c',
      LABEL: '#16a34a',
      STAGEFILE: '#0d9488',
      NOTIFICATION: '#db2777',
      PUBLISHER: '#4338ca',
      NOTE: '#9ca3af',
      STITCH: '#9ca3af',
      ACTIVITY_STREAM_LOGGER: '#6b7280',
      GLOBAL_VARIABLE: '#6b7280',
      ORCHESTRATION: '#0891b2',
      FOR_EACH: '#0e7490',
      WHILE: '#0e7490',
      WAIT: '#ca8a04',
      STOP: '#6b7280'
    },
    dark: {
      RECEIVE: '#60a5fa',
      INVOKE: '#93c5fd',
      REPLY: '#7dd3fc',
      TRANSFORMER: '#c4b5fd',
      ASSIGNMENT: '#9ca3af',
      ROUTER: '#fb923c',
      ROUTER_ROUTE: '#fdba74',
      TRY: '#fbbf24',
      GLOBAL_TRY: '#fbbf24',
      CATCH_ALL: '#f87171',
      TRY_CATCH: '#f87171',
      THROW: '#fca5a5',
      LABEL: '#4ade80',
      STAGEFILE: '#2dd4bf',
      NOTIFICATION: '#f472b6',
      PUBLISHER: '#818cf8',
      NOTE: '#6b7280',
      STITCH: '#6b7280',
      ACTIVITY_STREAM_LOGGER: '#94a3b8',
      GLOBAL_VARIABLE: '#94a3b8',
      ORCHESTRATION: '#22d3ee',
      FOR_EACH: '#22d3ee',
      WHILE: '#22d3ee',
      WAIT: '#facc15',
      STOP: '#6b7280'
    },
    'high-contrast': {
      RECEIVE: '#60a5fa',
      INVOKE: '#93c5fd',
      REPLY: '#38bdf8',
      TRANSFORMER: '#d8b4fe',
      ASSIGNMENT: '#d4d4d4',
      ROUTER: '#fb923c',
      ROUTER_ROUTE: '#fed7aa',
      TRY: '#fde68a',
      GLOBAL_TRY: '#fde68a',
      CATCH_ALL: '#fca5a5',
      TRY_CATCH: '#fca5a5',
      THROW: '#fecaca',
      LABEL: '#86efac',
      STAGEFILE: '#5eead4',
      NOTIFICATION: '#f9a8d4',
      PUBLISHER: '#a5b4fc',
      NOTE: '#a3a3a3',
      STITCH: '#a3a3a3',
      ACTIVITY_STREAM_LOGGER: '#d4d4d4',
      GLOBAL_VARIABLE: '#d4d4d4',
      ORCHESTRATION: '#67e8f9',
      FOR_EACH: '#67e8f9',
      WHILE: '#67e8f9',
      WAIT: '#fde047',
      STOP: '#a3a3a3'
    },
    solarized: {
      RECEIVE: '#268bd2',
      INVOKE: '#6c71c4',
      REPLY: '#2aa198',
      TRANSFORMER: '#d33682',
      ASSIGNMENT: '#839496',
      ROUTER: '#cb4b16',
      ROUTER_ROUTE: '#cb4b16',
      TRY: '#b58900',
      GLOBAL_TRY: '#b58900',
      CATCH_ALL: '#dc322f',
      TRY_CATCH: '#dc322f',
      THROW: '#dc322f',
      LABEL: '#859900',
      STAGEFILE: '#2aa198',
      NOTIFICATION: '#d33682',
      PUBLISHER: '#6c71c4',
      NOTE: '#657b83',
      STITCH: '#657b83',
      ACTIVITY_STREAM_LOGGER: '#839496',
      GLOBAL_VARIABLE: '#839496',
      ORCHESTRATION: '#2aa198',
      FOR_EACH: '#2aa198',
      WHILE: '#2aa198',
      WAIT: '#b58900',
      STOP: '#657b83'
    }
  };

  var TYPE_DISPLAY = {
    RECEIVE: 'RECEIVE',
    INVOKE: 'INVOKE',
    TRANSFORMER: 'MAP',
    ASSIGNMENT: 'ASSIGN',
    ROUTER: 'SWITCH',
    ROUTER_ROUTE: 'ROUTE',
    TRY: 'SCOPE',
    GLOBAL_TRY: 'SCOPE',
    CATCH_ALL: 'CATCH',
    TRY_CATCH: 'CATCH',
    THROW: 'THROW',
    LABEL: 'LABEL',
    STAGEFILE: 'STAGEFILE',
    NOTIFICATION: 'NOTIFY',
    PUBLISHER: 'PUBLISH',
    REPLY: 'REPLY',
    NOTE: 'NOTE',
    STITCH: 'STITCH',
    ACTIVITY_STREAM_LOGGER: 'LOG',
    GLOBAL_VARIABLE: 'VAR',
    ORCHESTRATION: 'ORCH',
    FOR_EACH: 'FOR-EACH',
    WHILE: 'WHILE',
    WAIT: 'WAIT',
    STOP: 'STOP'
  };

  /* ── Active type filters ────────────────────────────────────────────── */
  var activeTypeFilters = new Set();

  /* ── Search match navigation state ──────────────────────────────────── */
  var searchMatches = [];       // Array of DOM .iv-node elements currently matching
  var searchCurrentIdx = -1;    // -1 means no active focus

  /* ── Utility ────────────────────────────────────────────────────────── */

  function getBadgeColor(type) {
    var themeOverrides = colorOverrides[currentTheme];
    if (themeOverrides && themeOverrides[type]) {
      return themeOverrides[type];
    }
    var themeDefaults = DEFAULT_COLORS[currentTheme] || DEFAULT_COLORS.light;
    return themeDefaults[type] || '#6b7280';
  }

  function getDisplayType(type) {
    return TYPE_DISPLAY[type] || type;
  }

  // Returns true if activity is a LABEL whose children are all ASSIGNMENTs.
  // Such labels are rendered as an "ASSIGN" group badge.
  function isAssignGroup(activity) {
    if (!activity || activity.type !== 'LABEL') return false;
    var acts = activity.activities;
    if (!acts || acts.length === 0) return false;
    for (var i = 0; i < acts.length; i++) {
      if (acts[i].type !== 'ASSIGNMENT') return false;
    }
    return true;
  }

  // Returns the effective display type for an activity, taking into account
  // the LABEL→ASSIGN collapse rule above.
  function getEffectiveType(activity) {
    if (isAssignGroup(activity)) return 'ASSIGNMENT';
    return activity.type;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function getIntegrationInstance() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('integrationInstance') || '';
    } catch (e) {
      return '';
    }
  }

  function applyTheme(themeId) {
    currentTheme = themeId;
    if (overlay) {
      overlay.setAttribute('data-theme', themeId);
    }
  }

  function loadSettings(callback) {
    try {
      chrome.storage.local.get(
        ['ivTheme', 'ivColorOverrides', 'ivMaxXpathCharsInPreview'],
        function (result) {
          if (result.ivTheme) currentTheme = result.ivTheme;
          if (result.ivColorOverrides) colorOverrides = result.ivColorOverrides;
          if (typeof result.ivMaxXpathCharsInPreview === 'number' && result.ivMaxXpathCharsInPreview > 0) {
            maxXpathCharsInPreview = result.ivMaxXpathCharsInPreview;
          }
          if (callback) callback();
        }
      );
    } catch (e) {
      if (callback) callback();
    }
  }

  function sanitizeFilename(s) { return (s || '').replace(/[^a-zA-Z0-9_.-]/g, '_'); }

  // Copy text to clipboard with a brief visual confirmation on the source button.
  function copyToClipboard(text, srcBtn) {
    function flash(ok) {
      if (!srcBtn) return;
      var orig = srcBtn.textContent;
      var origTitle = srcBtn.title;
      srcBtn.textContent = ok ? '✓' : '✕';
      srcBtn.title = ok ? 'Copied' : 'Copy failed';
      setTimeout(function () { srcBtn.textContent = orig; srcBtn.title = origTitle; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(true); }, function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        flash(ok);
      } catch (e) {
        flash(false);
      }
    }
  }

  // Download a text payload as a file. path may include directories; only the
  // last segment is used as the filename after sanitization.
  function downloadText(text, path) {
    var parts = String(path || 'file').split('/');
    var name = sanitizeFilename(parts[parts.length - 1] || 'file');
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ── API helpers ─────────────────────────────────────────────────────── */

  var AUTH_HEADERS = { 'Authorization': 'session' };

  /* ── Archive (.iar) download/import and merging ─────────────────────── */

  // Download the integration archive (ZIP) from OIC
  function fetchArchive(code, version) {
    var inst = getIntegrationInstance();
    var url = '/ic/api/integration/v1/integrations/' +
      encodeURIComponent(code + '|' + version) +
      '/archive?includeRecordingFlag=false&allowLockedProject=true' +
      (inst ? '&integrationInstance=' + encodeURIComponent(inst) : '');
    return fetch(url, { headers: AUTH_HEADERS, credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('Archive fetch failed: ' + r.status + ' ' + r.statusText);
        return r.arrayBuffer();
      });
  }

  // Parse expr.properties into an object
  function parseExprProperties(text) {
    var result = {};
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var idx = lines[i].indexOf(':');
      if (idx < 0) continue;
      var key = lines[i].substring(0, idx).trim();
      var value = lines[i].substring(idx + 1).trim();
      if (key) result[key] = value;
    }
    return result;
  }

  // Detect nxsdmetadata.properties entries (JSON, despite the extension) and
  // explode embedded user-uploaded samples and derived schemas into synthetic
  // file entries so they appear in the UI like regular archive files.
  function extractNxsdSamples(detail) {
    if (!detail || !detail.files) return;
    var paths = Object.keys(detail.files);
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (!/nxsdmetadata\.properties$/i.test(p)) continue;
      var raw = detail.files[p];
      if (!raw) continue;
      var meta;
      try { meta = JSON.parse(raw); } catch (e) { continue; }
      if (!meta || typeof meta !== 'object') continue;

      var dir = p.replace(/\/[^\/]+$/, '/');
      var fileName = (meta.SELECT_SCHEMA_FILE_NAME || '').trim() || 'sample';
      var baseName = fileName.replace(/\.[^./]+$/, '');

      if (meta.SEL_SCHEMA_FILE_KEY) {
        detail.files[dir + 'uploaded-sample/' + fileName] = String(meta.SEL_SCHEMA_FILE_KEY);
      }
      if (meta.SELECT_SCHEMA_FILE_OBJECT) {
        detail.files[dir + 'derived-schema/' + baseName + '.xsd'] = String(meta.SELECT_SCHEMA_FILE_OBJECT);
      }
      // Keep the few metadata scalars on the detail for quick display
      if (!detail.nxsd) detail.nxsd = {};
      if (meta.SELECT_SCHEMA_FILE_NAME) detail.nxsd.fileName = meta.SELECT_SCHEMA_FILE_NAME;
      if (meta.SELECT_SCHEMA_ROOT_ELEMENT) detail.nxsd.rootElement = meta.SELECT_SCHEMA_ROOT_ELEMENT;
      if (meta.SCHEMA_OPTION_TYPE_KEY) detail.nxsd.schemaType = meta.SCHEMA_OPTION_TYPE_KEY;
    }
  }

  // Decode the XML/HTML entities used inside .jca attribute values.
  function decodeHtmlEntities(s) {
    if (!s) return '';
    return s
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&amp;/g, '&');
  }

  // Extract one <property name="X" value="..."> value from a .jca XML blob.
  function extractJcaProperty(xmlContent, propName) {
    var re = new RegExp('<property\\s+name="' + propName + '"\\s+value="([^"]*)"');
    var m = xmlContent.match(re);
    return m ? decodeHtmlEntities(m[1]) : '';
  }

  function pickSampleExtension(mediaType, sample) {
    if (mediaType) {
      if (/json/i.test(mediaType)) return 'json';
      if (/xml/i.test(mediaType)) return 'xml';
    }
    var trimmed = (sample || '').replace(/^\s+/, '');
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') return 'json';
    if (trimmed.charAt(0) === '<') return 'xml';
    return 'txt';
  }

  function prettifyIfJson(text, ext) {
    if (ext !== 'json' || !text) return text;
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch (e) { return text; }
  }

  // Detect inline Request/Response samples in .jca adapter configs and
  // explode them into synthetic file entries so they appear in the UI.
  function extractJcaSamples(detail) {
    if (!detail || !detail.files) return;
    var paths = Object.keys(detail.files);
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (!/\.jca$/i.test(p)) continue;
      var content = detail.files[p];
      if (!content) continue;

      var dir = p.replace(/\/[^\/]+$/, '/');
      var baseFile = (p.split('/').pop() || '').replace(/\.jca$/i, '');
      var endpointBase = baseFile.replace(/_REQUEST$/i, '').replace(/_RESPONSE$/i, '');

      var reqMedia = extractJcaProperty(content, 'RequestMediaType');
      var respMedia = extractJcaProperty(content, 'ResponseMediaType');
      var reqSample = extractJcaProperty(content, 'RequestSample');
      var respSample = extractJcaProperty(content, 'ResponseSample');

      if (reqSample) {
        var reqExt = pickSampleExtension(reqMedia, reqSample);
        detail.files[dir + 'request-sample/' + endpointBase + '_request.' + reqExt] = prettifyIfJson(reqSample, reqExt);
      }
      if (respSample) {
        var respExt = pickSampleExtension(respMedia, respSample);
        detail.files[dir + 'response-sample/' + endpointBase + '_response.' + respExt] = prettifyIfJson(respSample, respExt);
      }
    }
  }

  // Parse archive ZIP (ArrayBuffer). Returns { projectXml: string, fileMap: {relativePath: content} }
  // fileMap paths are relative to .../resources/ (e.g. "processor_211/resourcegroup_X/expr.properties")
  function parseArchive(arrayBuffer) {
    if (typeof JSZip === 'undefined') {
      return Promise.reject(new Error('JSZip library not loaded'));
    }
    return JSZip.loadAsync(arrayBuffer).then(function (zip) {
      // Find project root by locating PROJECT-INF/project.xml
      var projectInfPath = null;
      zip.forEach(function (path) {
        if (projectInfPath) return;
        if (/PROJECT-INF\/project\.xml$/.test(path)) projectInfPath = path;
      });
      if (!projectInfPath) throw new Error('project.xml not found in archive');

      // Derive resources/ path — same parent as PROJECT-INF/
      var projectRoot = projectInfPath.replace(/PROJECT-INF\/project\.xml$/, '');
      var resourcesPrefix = projectRoot + 'resources/';

      var filePromises = [];
      var fileMap = {};
      var projectXml = '';

      // Read project.xml
      filePromises.push(
        zip.file(projectInfPath).async('string').then(function (text) { projectXml = text; })
      );

      // Read all text files under resources/
      zip.forEach(function (path, file) {
        if (file.dir) return;
        if (path.indexOf(resourcesPrefix) !== 0) return;
        var rel = path.substring(resourcesPrefix.length);
        var lower = rel.toLowerCase();
        var isText = /\.(properties|json|xml|xsl|xsd|wsdl|jca|txt|xslt)$/.test(lower);
        if (!isText) return;
        filePromises.push(
          file.async('string').then(function (content) { fileMap[rel] = content; })
        );
      });

      return Promise.all(filePromises).then(function () {
        return { projectXml: projectXml, fileMap: fileMap };
      });
    });
  }

  /* ── project.xml → blueprint JSON ──────────────────────────────────── */

  // Map XML local element names to activity types
  var XML_TYPE_MAP = {
    globalTry: 'GLOBAL_TRY',
    try: 'TRY',
    catchAll: 'CATCH_ALL',
    catch: 'TRY_CATCH',
    router: 'ROUTER',
    route: 'ROUTER_ROUTE',
    label: 'LABEL',
    receive: 'RECEIVE',
    scheduleReceive: 'RECEIVE',
    invoke: 'INVOKE',
    transformer: 'TRANSFORMER',
    assignment: 'ASSIGNMENT',
    throw: 'THROW',
    note: 'NOTE',
    reply: 'REPLY',
    publish: 'PUBLISHER',
    notification: 'NOTIFICATION',
    stageFile: 'STAGEFILE',
    stageStream: 'STAGEFILE',
    stitch: 'STITCH',
    activityStreamLogger: 'ACTIVITY_STREAM_LOGGER',
    globalVariable: 'GLOBAL_VARIABLE',
    for: 'FOR_EACH',
    while: 'WHILE',
    wait: 'WAIT',
    scope: 'TRY',
    stop: 'STOP',
    ehStop: 'STOP'
  };

  function parseApplicationsXml(rootEl) {
    // Returns map: applicationName -> { connectionTypeName, connectionName, mep, role, binding, ... }
    var result = {};
    var apps = rootEl.getElementsByTagNameNS('*', 'application');
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      // Only direct children of icsflow (skip nested)
      if (app.parentNode && app.parentNode.localName !== 'icsflow') continue;
      var name = app.getAttribute('name');
      if (!name) continue;
      var entry = { name: name };
      // role
      var roleEl = firstChildByName(app, 'role');
      if (roleEl) entry.role = roleEl.textContent.trim();
      // adapter
      var adapterEl = firstChildByName(app, 'adapter');
      if (adapterEl) {
        var typeEl = firstChildByName(adapterEl, 'type');
        var codeEl = firstChildByName(adapterEl, 'code');
        var nameEl = firstChildByName(adapterEl, 'name');
        if (codeEl) entry.connectionTypeName = codeEl.textContent.trim();
        if (nameEl) entry.connectionName = nameEl.textContent.trim();
        if (typeEl) entry.adapterType = typeEl.textContent.trim();
      }
      // mep
      var mepEl = firstChildByName(app, 'mep');
      if (mepEl) entry.endpointMEP = mepEl.textContent.trim();
      // binding (from outbound/inbound)
      var outIn = firstChildByName(app, 'outbound') || firstChildByName(app, 'inbound');
      if (outIn) {
        var bEl = firstChildByName(outIn, 'binding');
        if (bEl) entry.binding = bEl.textContent.trim();
        var opEl = firstChildByName(outIn, 'operation');
        if (opEl) entry.endpointName = opEl.textContent.trim();
      }
      result[name] = entry;
    }
    return result;
  }

  function parseProcessorsXml(rootEl) {
    // Returns map: processorName (e.g. "processor_611") -> { processorName, type, role }
    var result = {};
    var procs = rootEl.getElementsByTagNameNS('*', 'processor');
    for (var i = 0; i < procs.length; i++) {
      var proc = procs[i];
      if (proc.parentNode && proc.parentNode.localName !== 'icsflow') continue;
      var name = proc.getAttribute('name');
      if (!name) continue;
      var entry = { name: name };
      var typeEl = firstChildByName(proc, 'type');
      if (typeEl) entry.type = typeEl.textContent.trim();
      var roleEl = firstChildByName(proc, 'role');
      if (roleEl) entry.role = roleEl.textContent.trim();
      var pnEl = firstChildByName(proc, 'processorName');
      if (pnEl) entry.processorName = pnEl.textContent.trim();
      result[name] = entry;
    }
    return result;
  }

  function firstChildByName(el, localName) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 1 && c.localName === localName) return c;
    }
    return null;
  }

  function childElementsByLocalName(el) {
    var out = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 1) out.push(c);
    }
    return out;
  }

  function xmlElementToActivity(el, appsMap, procsMap) {
    var local = el.localName;
    var mappedType = XML_TYPE_MAP[local];
    if (!mappedType) return null;

    var activity = {
      type: mappedType,
      id: el.getAttribute('id') || '',
      refUri: el.getAttribute('refUri') || ''
    };

    var name = el.getAttribute('name');
    if (name) activity.name = name;
    var displayName = el.getAttribute('displayName');
    if (displayName) activity.displayName = displayName;
    var description = el.getAttribute('description');
    if (description) activity.description = description;
    var trackingRefUri = el.getAttribute('trackingRefUri');
    if (trackingRefUri) activity.trackingRefUri = trackingRefUri;
    var faultName = el.getAttribute('faultName');
    if (faultName) activity.faultName = faultName;

    // Enrich from applications or processors map based on refUri prefix
    if (activity.refUri) {
      var first = activity.refUri.split('/')[0];
      if (/^application_/.test(first) && appsMap && appsMap[first]) {
        var app = appsMap[first];
        if (app.connectionTypeName) activity.connectionTypeName = app.connectionTypeName;
        if (app.connectionName && !activity.name) activity.name = app.connectionName;
        if (app.connectionName) activity.connectionName = app.connectionName;
        if (app.endpointMEP) activity.endpointMEP = app.endpointMEP;
        if (app.endpointName && !activity.endpointName) activity.endpointName = app.endpointName;
        if (app.binding) activity.binding = app.binding;
        if (app.adapterType) activity.adapterType = app.adapterType;
      } else if (/^processor_/.test(first) && procsMap && procsMap[first]) {
        var proc = procsMap[first];
        if (proc.processorName && !activity.name) activity.name = proc.processorName;
      }
    }

    // Walk children
    var childEls = childElementsByLocalName(el);
    var activities = [];
    var routes = [];
    var catches = [];
    var catchAll = null;

    for (var i = 0; i < childEls.length; i++) {
      var child = childEls[i];
      var clocal = child.localName;
      if (clocal === 'catchAll') {
        catchAll = xmlElementToActivity(child, appsMap, procsMap);
      } else if (clocal === 'catch') {
        var cc = xmlElementToActivity(child, appsMap, procsMap);
        if (cc) catches.push(cc);
      } else if (clocal === 'route') {
        var r = xmlElementToActivity(child, appsMap, procsMap);
        if (r) routes.push(r);
      } else if (XML_TYPE_MAP[clocal]) {
        var a = xmlElementToActivity(child, appsMap, procsMap);
        if (a) activities.push(a);
      }
    }

    if (activities.length > 0) activity.activities = activities;
    if (routes.length > 0) activity.routes = routes;
    if (catches.length > 0) activity.catches = catches;
    if (catchAll) activity.catchAll = catchAll;

    return activity;
  }

  function parseProjectXml(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'application/xml');
    var parserError = doc.getElementsByTagName('parsererror');
    if (parserError && parserError.length > 0) {
      throw new Error('project.xml parse error: ' + parserError[0].textContent);
    }

    var root = doc.documentElement; // <ns3:icsproject>
    var projectCode = (firstChildByName(root, 'projectCode') || {}).textContent || '';
    var projectVersion = (firstChildByName(root, 'projectVersion') || {}).textContent || '';
    var projectName = (firstChildByName(root, 'projectName') || {}).textContent || '';

    var icsflow = firstChildByName(root, 'icsflow');
    if (!icsflow) throw new Error('No icsflow element found');

    var appsMap = parseApplicationsXml(icsflow);
    var procsMap = parseProcessorsXml(icsflow);

    var orchestration = firstChildByName(icsflow, 'orchestration');
    if (!orchestration) throw new Error('No orchestration element found');

    var globalTryEl = firstChildByName(orchestration, 'globalTry');
    var globalTry = globalTryEl ? xmlElementToActivity(globalTryEl, appsMap, procsMap) : null;

    // Collect global variables (if any top-level globalVariable elements)
    var globalVariables = [];
    var gvEls = childElementsByLocalName(orchestration);
    for (var i = 0; i < gvEls.length; i++) {
      if (gvEls[i].localName === 'globalVariable') {
        var gv = xmlElementToActivity(gvEls[i], appsMap, procsMap);
        if (gv) globalVariables.push(gv);
      }
    }

    return {
      name: projectName.trim(),
      code: projectCode.trim(),
      version: projectVersion.trim(),
      pattern: 'Orchestration',
      orchestration: {
        type: 'ORCHESTRATION',
        globalTry: globalTry || { type: 'GLOBAL_TRY', activities: [] },
        globalVariables: globalVariables
      },
      _applications: appsMap,
      _processors: procsMap
    };
  }

  // Given a refUri and activity type, return archive files belonging to that activity.
  //   application_41/outbound_42/output_49 → strip trailing output/input/fault (adapter files live one level up)
  //   processor_211/output_212              → exact subtree (ROUTE uses its own output folder)
  //   processor_211 with type=ROUTER        → only files NOT inside output_/input_/fault_ subfolders
  //                                           (those belong to child ROUTER_ROUTEs)
  //   processor_211 (other types)           → full subtree
  function getArchiveFilesForRefUri(fileMap, refUri, activityType) {
    if (!refUri) return [];
    var folder = refUri;
    if (/^application_/.test(refUri)) {
      folder = refUri.replace(/\/(output|input|fault)_\d+$/, '');
    }
    var excludeRouteSubfolders = activityType === 'ROUTER';
    var result = [];
    var keys = Object.keys(fileMap);
    for (var i = 0; i < keys.length; i++) {
      var p = keys[i];
      if (p !== folder && p.indexOf(folder + '/') !== 0) continue;
      if (excludeRouteSubfolders) {
        var rel = p.substring(folder.length + 1);
        if (/^(output|input|fault)_\d+(\/|$)/.test(rel)) continue;
      }
      result.push({ path: p, content: fileMap[p] });
    }
    return result;
  }

  // Merge archive data into all activities in the blueprint
  function mergeArchiveIntoBlueprint(bp, fileMap) {
    var count = 0;
    function walk(activity) {
      if (!activity || typeof activity !== 'object') return;

      if (activity.refUri) {
        var files = getArchiveFilesForRefUri(fileMap, activity.refUri, activity.type);
        if (files.length > 0) {
          var detail = { files: {} };
          for (var i = 0; i < files.length; i++) {
            detail.files[files[i].path] = files[i].content;
            // Parse expr.properties specially for easier display
            if (/expr\.properties$/.test(files[i].path)) {
              detail.expression = parseExprProperties(files[i].content);
            }
          }
          // Extract user-uploaded sample & derived schema from nxsdmetadata.properties
          extractNxsdSamples(detail);
          // Extract inline request/response samples from .jca files
          extractJcaSamples(detail);
          activity._archiveDetail = detail;
          // Lift useful fields onto the activity itself
          if (detail.expression) {
            if (detail.expression.VariableName && !activity.variableName) {
              activity.variableName = detail.expression.VariableName;
            }
            if (detail.expression.VariableDescription && !activity.variableDescription) {
              activity.variableDescription = detail.expression.VariableDescription;
            }
            // ROUTER_ROUTE: lift ExpressionName as the route's display name (e.g. "ValidateRegion", "Otherwise")
            if (activity.type === 'ROUTER_ROUTE' && detail.expression.ExpressionName && !activity.name) {
              activity.name = detail.expression.ExpressionName;
            }
          }
          // TRANSFORMER: parse mapTargets from XSL to get target name
          if (activity.type === 'TRANSFORMER' && !activity.mappedTarget) {
            for (var fp in detail.files) {
              if (!Object.prototype.hasOwnProperty.call(detail.files, fp)) continue;
              if (!/\/req_[^\/]*\.xsl$/.test(fp)) continue;
              var xsl = detail.files[fp];
              var tgtBlock = xsl.match(/<oracle-xsl-mapper:mapTargets[\s\S]*?<\/oracle-xsl-mapper:mapTargets>/);
              if (!tgtBlock) break;
              var locMatch = tgtBlock[0].match(/location="([^"]+)"/);
              if (!locMatch) break;
              // Try to match application_XXX in path
              var appMatch = locMatch[1].match(/application_\d+/);
              if (appMatch && bp && bp._applications && bp._applications[appMatch[0]]) {
                activity.mappedTarget = { name: bp._applications[appMatch[0]].connectionName };
              } else {
                // Fall back: use the filename prefix (e.g. "CreateOrder_REQUEST.wsdl" → "CreateOrder")
                var fnMatch = locMatch[1].match(/\/([^\/]+)_REQUEST\.(wsdl|xsd)$/);
                if (fnMatch) activity.mappedTarget = { name: fnMatch[1] };
              }
              break;
            }
          }
          count++;
        }
      }

      // Recurse into children
      var childKeys = ['activities', 'routes', 'catches'];
      for (var k = 0; k < childKeys.length; k++) {
        var arr = activity[childKeys[k]];
        if (Array.isArray(arr)) {
          for (var j = 0; j < arr.length; j++) walk(arr[j]);
        }
      }
      if (activity.catchAll) walk(activity.catchAll);
    }

    if (bp && bp.orchestration) {
      if (bp.orchestration.globalTry) walk(bp.orchestration.globalTry);
      if (bp.orchestration.globalVariables) {
        for (var i = 0; i < bp.orchestration.globalVariables.length; i++) {
          walk(bp.orchestration.globalVariables[i]);
        }
      }
    }
    return count;
  }

  /* ── Overlay lifecycle ──────────────────────────────────────────────── */

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'oic-iv-overlay';
    overlay.setAttribute('data-theme', currentTheme);

    /* Header */
    var header = document.createElement('div');
    header.className = 'iv-header';

    var title = document.createElement('h2');
    title.textContent = 'Integration Viewer';

    var meta = document.createElement('span');
    meta.className = 'iv-meta';
    meta.id = 'iv-meta-text';

    var themeSelect = document.createElement('select');
    themeSelect.className = 'iv-theme-select';
    THEMES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      if (t.id === currentTheme) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', function () {
      applyTheme(themeSelect.value);
      try { chrome.storage.local.set({ ivTheme: themeSelect.value }); } catch (e) { }
      rerenderTree();
    });

    var closeBtn = document.createElement('button');
    closeBtn.className = 'iv-close-btn';
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', closeOverlay);

    header.appendChild(title);
    header.appendChild(meta);
    header.appendChild(themeSelect);
    header.appendChild(closeBtn);

    /* Toolbar */
    var toolbar = document.createElement('div');
    toolbar.className = 'iv-toolbar';

    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'iv-search-input';
    searchInput.placeholder = 'Search activities…';
    searchInput.addEventListener('input', debounce(applyFilters, 200));
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateToMatch(e.shiftKey ? 'prev' : 'next');
      }
    });

    var searchPrevBtn = document.createElement('button');
    searchPrevBtn.id = 'iv-search-prev';
    searchPrevBtn.className = 'iv-search-nav';
    searchPrevBtn.textContent = '▲';
    searchPrevBtn.title = 'Previous match (Shift+Enter)';
    searchPrevBtn.addEventListener('click', function () { navigateToMatch('prev'); });

    var searchNextBtn = document.createElement('button');
    searchNextBtn.id = 'iv-search-next';
    searchNextBtn.className = 'iv-search-nav';
    searchNextBtn.textContent = '▼';
    searchNextBtn.title = 'Next match (Enter)';
    searchNextBtn.addEventListener('click', function () { navigateToMatch('next'); });

    var matchCount = document.createElement('span');
    matchCount.className = 'iv-match-count';
    matchCount.id = 'iv-match-count';

    /* Filter container */
    var filterContainer = document.createElement('div');
    filterContainer.className = 'iv-filter-container';

    var filterBtn = document.createElement('button');
    filterBtn.id = 'iv-filter-btn';
    filterBtn.textContent = '⚙ Filter Types';
    filterBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFilterDropdown();
    });

    var filterDropdown = document.createElement('div');
    filterDropdown.className = 'iv-filter-dropdown';
    filterDropdown.id = 'iv-filter-dropdown';

    filterContainer.appendChild(filterBtn);
    filterContainer.appendChild(filterDropdown);

    var expandBtn = document.createElement('button');
    expandBtn.textContent = '⊞ Expand All';
    expandBtn.addEventListener('click', function () { expandCollapseAll(true); });

    var collapseBtn = document.createElement('button');
    collapseBtn.textContent = '⊟ Collapse All';
    collapseBtn.addEventListener('click', function () { expandCollapseAll(false); });

    var exportHtmlBtn = document.createElement('button');
    exportHtmlBtn.textContent = '⬇ HTML';
    exportHtmlBtn.addEventListener('click', exportHtml);

    var exportJsonBtn = document.createElement('button');
    exportJsonBtn.textContent = '⬇ JSON';
    exportJsonBtn.addEventListener('click', exportJson);

    var compareBtn = document.createElement('button');
    compareBtn.id = 'iv-compare-btn';
    compareBtn.textContent = '📊 Compare…';
    compareBtn.title = 'Compare this integration with another';
    compareBtn.addEventListener('click', function () { openCompareOverlay(blueprintData); });

    var progressSpan = document.createElement('span');
    progressSpan.className = 'iv-progress-span';
    progressSpan.id = 'iv-progress-span';

    toolbar.appendChild(searchInput);
    toolbar.appendChild(searchPrevBtn);
    toolbar.appendChild(searchNextBtn);
    toolbar.appendChild(matchCount);
    toolbar.appendChild(filterContainer);
    toolbar.appendChild(expandBtn);
    toolbar.appendChild(collapseBtn);
    toolbar.appendChild(exportHtmlBtn);
    toolbar.appendChild(exportJsonBtn);
    toolbar.appendChild(compareBtn);
    toolbar.appendChild(progressSpan);

    /* Source bar (integration code + version + import live / upload) */
    var sourceBar = document.createElement('div');
    sourceBar.className = 'iv-source-bar';

    var codeLabel = document.createElement('label');
    codeLabel.className = 'iv-source-label';
    codeLabel.textContent = 'Code';
    var codeField = document.createElement('input');
    codeField.type = 'text';
    codeField.id = 'iv-src-code';
    codeField.className = 'iv-source-input';
    codeField.placeholder = 'e.g. CREATE_ORDER_IN_ORACLE';

    var versionLabel = document.createElement('label');
    versionLabel.className = 'iv-source-label';
    versionLabel.textContent = 'Version';
    var versionField = document.createElement('input');
    versionField.type = 'text';
    versionField.id = 'iv-src-version';
    versionField.className = 'iv-source-input iv-source-input-sm';
    versionField.placeholder = 'e.g. 01.00.0040';

    // Restore last-used values
    try {
      chrome.storage.local.get(['ivLastCode', 'ivLastVersion'], function (data) {
        if (data.ivLastCode) codeField.value = data.ivLastCode;
        if (data.ivLastVersion) versionField.value = data.ivLastVersion;
      });
    } catch (e) { /* noop */ }

    function saveSource() {
      try {
        chrome.storage.local.set({
          ivLastCode: codeField.value.trim(),
          ivLastVersion: versionField.value.trim()
        });
      } catch (e) { /* noop */ }
    }

    var liveBtn = document.createElement('button');
    liveBtn.id = 'iv-archive-btn';
    liveBtn.textContent = '📦 Import Live';
    liveBtn.title = 'Download archive from the OIC server';
    liveBtn.addEventListener('click', function () {
      var c = codeField.value.trim();
      var v = versionField.value.trim();
      if (!c || !v) {
        showError('Enter both Integration Code and Version.');
        return;
      }
      currentCode = c;
      currentVersion = v;
      saveSource();
      loadArchiveFromServer();
    });

    var uploadBtn = document.createElement('button');
    uploadBtn.id = 'iv-upload-btn';
    uploadBtn.textContent = '📂 Upload Archive';
    uploadBtn.title = 'Upload a .iar archive from your computer';
    uploadBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.iar,.zip';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          loadArchiveFromFile(reader.result);
        };
        reader.onerror = function () {
          showError('Failed to read file: ' + (reader.error && reader.error.message));
        };
        reader.readAsArrayBuffer(file);
      });
      input.click();
    });

    // Enter on version triggers Import Live
    versionField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') liveBtn.click();
    });
    codeField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') versionField.focus();
    });

    sourceBar.appendChild(codeLabel);
    sourceBar.appendChild(codeField);
    sourceBar.appendChild(versionLabel);
    sourceBar.appendChild(versionField);
    sourceBar.appendChild(liveBtn);
    sourceBar.appendChild(uploadBtn);

    /* Tree container */
    var treeContainer = document.createElement('div');
    treeContainer.className = 'iv-tree-container';
    treeContainer.id = 'iv-tree-container';

    overlay.appendChild(header);
    overlay.appendChild(sourceBar);
    overlay.appendChild(toolbar);
    overlay.appendChild(treeContainer);

    document.body.appendChild(overlay);

    // Fullscreen / Copy / Download button clicks inside detail bodies
    overlay.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('.iv-fullscreen-btn');
      if (!btn) return;
      e.stopPropagation();
      var row = btn.closest('.iv-detail-row');
      var pre = row && row.nextElementSibling;
      if (!pre || !pre.classList.contains('iv-archive-file')) return;
      var path = btn.getAttribute('data-file-path') || 'file';
      var content = pre.textContent;
      var action = btn.getAttribute('data-file-action');
      if (action === 'copy') {
        copyToClipboard(content, btn);
      } else if (action === 'download') {
        downloadText(content, path);
      } else {
        openFullscreenViewer(path, content);
      }
    });

    document.addEventListener('keydown', onKeyDown);

    // Close filter dropdown when clicking outside
    document.addEventListener('click', function (e) {
      var dd = document.getElementById('iv-filter-dropdown');
      if (dd && dd.classList.contains('open')) {
        var fc = dd.closest('.iv-filter-container') || (dd.parentElement);
        if (fc && !fc.contains(e.target)) {
          dd.classList.remove('open');
        }
      }
    });
  }

  function closeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    document.removeEventListener('keydown', onKeyDown);
  }

  // Opens a full-viewport view of a file's content on top of the overlay.
  function openFullscreenViewer(path, content) {
    var existing = document.getElementById('oic-iv-fullscreen');
    if (existing) existing.remove();

    var fs = document.createElement('div');
    fs.id = 'oic-iv-fullscreen';
    fs.setAttribute('data-theme', currentTheme);

    var header = document.createElement('div');
    header.className = 'iv-fs-header';

    var title = document.createElement('span');
    title.className = 'iv-fs-title';
    title.textContent = path;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'iv-fs-close';
    closeBtn.textContent = '✕ Close';

    var body = document.createElement('pre');
    body.className = 'iv-fs-body';
    body.textContent = content;

    function closeFs() {
      document.removeEventListener('keydown', escHandler);
      fs.remove();
    }
    function escHandler(e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeFs(); }
    }

    closeBtn.addEventListener('click', closeFs);
    document.addEventListener('keydown', escHandler);

    var copyBtn = document.createElement('button');
    copyBtn.className = 'iv-fs-action';
    copyBtn.textContent = '📋 Copy';
    copyBtn.title = 'Copy content to clipboard';
    copyBtn.addEventListener('click', function () { copyToClipboard(content, copyBtn); });

    var dlBtn = document.createElement('button');
    dlBtn.className = 'iv-fs-action';
    dlBtn.textContent = '⬇ Download';
    dlBtn.title = 'Download as file';
    dlBtn.addEventListener('click', function () { downloadText(content, path); });

    header.appendChild(title);
    header.appendChild(copyBtn);
    header.appendChild(dlBtn);
    header.appendChild(closeBtn);
    fs.appendChild(header);
    fs.appendChild(body);
    document.body.appendChild(fs);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeOverlay();
  }

  function showError(msg) {
    var tc = document.getElementById('iv-tree-container');
    if (!tc) return;
    tc.innerHTML =
      '<div class="iv-error">' +
      '<div class="iv-error-icon">⚠</div>' +
      '<div>' + escapeHtml(msg || 'An error occurred') + '</div>' +
      '</div>';
  }

  /* ── Tree rendering ─────────────────────────────────────────────────── */

  function getActivityName(activity) {
    // For adapter-backed activities, prefer the adapter's connection name over the operation name
    var t = activity.type;
    if (t === 'INVOKE' || t === 'RECEIVE' || t === 'REPLY' || t === 'PUBLISHER') {
      if (activity.connectionName) return activity.connectionName;
    }
    // TRANSFORMER shows its mapped target name
    if (t === 'TRANSFORMER' && activity.mappedTarget && activity.mappedTarget.name) {
      return activity.mappedTarget.name;
    }
    return activity.endpointName ||
      activity.name ||
      activity.faultName ||
      activity.variableName ||
      activity.id ||
      '(unnamed)';
  }

  // Returns the XPath expression for an activity from its archive detail, or ''
  function getActivityXpath(activity) {
    var ad = activity && activity._archiveDetail;
    if (!ad || !ad.expression) return '';
    return ad.expression.XpathExpression || ad.expression.TextExpression || '';
  }

  function truncateXpath(xpath) {
    if (!xpath) return '';
    if (xpath.length <= maxXpathCharsInPreview) return xpath;
    return xpath.substring(0, maxXpathCharsInPreview) + '…';
  }

  // Breadcrumb-friendly label, includes type prefix for scopes and route condition
  function getBreadcrumbLabel(activity) {
    var t = activity._virtualType ? activity._virtualType : activity.type;
    var name = activity._virtualType ? (activity._label || t) : getActivityName(activity);
    if (t === 'TRY' || t === 'GLOBAL_TRY') {
      return 'Scope ' + name;
    }
    if (t === 'ROUTER') {
      return 'Switch ' + name;
    }
    if (t === 'ROUTER_ROUTE') {
      return 'Route ' + (activity.name || activity.id || '');
    }
    return name;
  }

  function getChildren(activity) {
    var type = activity.type || activity._virtualType || '';
    var children = [];

    if (type === 'TRY' || type === 'GLOBAL_TRY') {
      // Main container — always present (holds the scope's activities)
      children.push({
        _virtualType: 'TRY_BLOCK',
        _label: 'Main',
        activities: activity.activities || []
      });
      // Faults container — only if there are catches or a catchAll
      var hasCatches = activity.catches && activity.catches.length > 0;
      var hasCatchAll = !!activity.catchAll;
      if (hasCatches || hasCatchAll) {
        var faultChildren = [];
        if (hasCatches) {
          activity.catches.forEach(function (c) { faultChildren.push(c); });
        }
        if (hasCatchAll) {
          faultChildren.push(activity.catchAll);
        }
        children.push({
          _virtualType: 'FAULTS_BLOCK',
          _label: 'Faults',
          activities: faultChildren
        });
      }
    } else if (type === 'FOR_EACH' || type === 'WHILE') {
      // Loop containers — children are their activities
      var loopActs = activity.activities || [];
      loopActs.forEach(function (a) { children.push(a); });
    } else if (type === 'ROUTER') {
      var routes = activity.routes || activity.routerRoutes || [];
      routes.forEach(function (r) { children.push(r); });
    } else if (type === 'TRY_BLOCK' || type === 'FAULTS_BLOCK') {
      // virtual container — children are its activities
      var acts = activity.activities || [];
      acts.forEach(function (a) { children.push(a); });
    } else {
      var acts2 = activity.activities || [];
      acts2.forEach(function (a) { children.push(a); });
    }
    return children;
  }

  function buildBreadcrumb(path) {
    return path.join(' › ');
  }

  function getSearchableText(activity) {
    var parts = [
      activity.type || '',
      activity.name || '',
      activity.endpointName || '',
      activity.variableName || '',
      activity.variableDescription || '',
      activity.id || '',
      activity.refUri || '',
      activity.faultName || '',
      activity.connectionId || '',
      activity.connectionName || '',
      activity.connectionTypeName || '',
      activity.adapterType || '',
      activity.mep || '',
      activity.endpointMEP || '',
      activity.binding || '',
      activity.requestEndpoint || '',
      activity.responseEndpoint || '',
      activity.condition || '',
      activity.expression || '',
      activity.xpathExpression || '',
      activity.description || '',
      getDisplayType(activity.type || '')
    ];
    // mappedTarget.name (TRANSFORMER)
    if (activity.mappedTarget && activity.mappedTarget.name) parts.push(activity.mappedTarget.name);
    // Archive-sourced content
    if (activity._archiveDetail) {
      var ad = activity._archiveDetail;
      if (ad.expression) {
        if (ad.expression.TextExpression) parts.push(ad.expression.TextExpression);
        if (ad.expression.XpathExpression) parts.push(ad.expression.XpathExpression);
        if (ad.expression.VariableName) parts.push(ad.expression.VariableName);
        if (ad.expression.VariableType) parts.push(ad.expression.VariableType);
        if (ad.expression.VariableDescription) parts.push(ad.expression.VariableDescription);
      }
      if (ad.files) {
        var keys = Object.keys(ad.files);
        for (var i = 0; i < keys.length; i++) {
          parts.push(keys[i]);
          parts.push(ad.files[keys[i]]);
        }
      }
    }
    return parts.join(' ').toLowerCase();
  }

  function renderDetail(activity) {
    var rows = [];

    function addRow(label, value) {
      if (value == null || value === '' || value === false) return;
      rows.push(
        '<div class="iv-detail-row">' +
        '<span class="iv-detail-label">' + escapeHtml(label) + '</span>' +
        '<span class="iv-detail-value">' + escapeHtml(String(value)) + '</span>' +
        '</div>'
      );
    }

    addRow('Type', activity.type);
    addRow('ID', activity.id);
    addRow('Name', activity.name);
    addRow('Endpoint Name', activity.endpointName);
    addRow('Variable Name', activity.variableName);
    addRow('Connection ID', activity.connectionId);
    addRow('Adapter Type', activity.adapterType);
    addRow('MEP', activity.mep);
    addRow('Request Endpoint', activity.requestEndpoint);
    addRow('Response Endpoint', activity.responseEndpoint);
    addRow('Condition', activity.condition);
    addRow('Expression', activity.expression);
    addRow('XPath', activity.xpathExpression);
    addRow('Mapping', activity.mappingName || activity.mapName);
    if (activity.variableType) {
      var vt = activity.variableType;
      addRow('Variable Type', vt.elementName + (vt.variableTypeClass ? ' (' + vt.variableTypeClass + ')' : ''));
    }
    addRow('Description', activity.description);
    if (activity.configured != null) addRow('Configured', activity.configured ? 'Yes' : 'No');

    // Archive-sourced details
    if (activity._archiveDetail) {
      var ad = activity._archiveDetail;
      if (ad.expression) {
        var e = ad.expression;
        if (e.TextExpression) addRow('Expression', e.TextExpression);
        if (e.XpathExpression) addRow('XPath', e.XpathExpression);
        if (e.VariableType) addRow('Var Type', e.VariableType);
      }
      if (ad.nxsd) {
        if (ad.nxsd.fileName) addRow('Sample File', ad.nxsd.fileName);
        if (ad.nxsd.rootElement) addRow('Root Element', ad.nxsd.rootElement);
        if (ad.nxsd.schemaType) addRow('Schema Type', ad.nxsd.schemaType);
      }
      if (ad.files) {
        var paths = Object.keys(ad.files);
        for (var fi = 0; fi < paths.length; fi++) {
          var p = paths[fi];
          var content = ad.files[p];
          rows.push(
            '<div class="iv-detail-row">' +
            '<span class="iv-detail-label">File</span>' +
            '<span class="iv-detail-value">' + escapeHtml(p) + '</span>' +
            '<button class="iv-fullscreen-btn iv-file-action" title="Copy to clipboard" data-file-action="copy" data-file-path="' + escapeHtml(p) + '">📋</button>' +
            '<button class="iv-fullscreen-btn iv-file-action" title="Download file" data-file-action="download" data-file-path="' + escapeHtml(p) + '">⬇</button>' +
            '<button class="iv-fullscreen-btn" title="Fullscreen" data-file-path="' + escapeHtml(p) + '">⛶</button>' +
            '</div>' +
            '<pre class="iv-archive-file">' + escapeHtml(content) + '</pre>'
          );
        }
      }
    }

    if (rows.length === 0) return '';
    return rows.join('');
  }

  function renderNode(activity, depth, parentPath) {
    depth = depth || 0;
    parentPath = parentPath || [];

    var type = activity.type || activity._virtualType || 'UNKNOWN';
    var isvirtual = !!activity._virtualType;
    var effectiveType = isvirtual ? type : getEffectiveType(activity);
    var name = isvirtual ? (activity._label || type) : getActivityName(activity);
    var displayType = isvirtual ? (activity._label || type) : getDisplayType(effectiveType);
    var children = getChildren(activity);
    var hasChildren = children.length > 0;
    var currentPath = parentPath.concat([getBreadcrumbLabel(activity)]);
    var searchText = isvirtual ? name.toLowerCase() : getSearchableText(activity);

    var node = document.createElement('div');
    node.className = 'iv-node';
    node._activityData = activity;
    node._searchText = searchText;
    node._type = type;
    node._effectiveType = effectiveType;

    /* Header row */
    var header = document.createElement('div');
    header.className = 'iv-node-header';

    /* Toggle */
    var toggle = document.createElement('span');
    toggle.className = 'iv-toggle' + (hasChildren ? '' : ' iv-leaf');
    toggle.textContent = hasChildren ? '▶' : '·';

    /* Type badge */
    var badge = document.createElement('span');
    badge.className = 'iv-type-badge';
    badge.textContent = displayType;
    if (!isvirtual) {
      badge.style.background = getBadgeColor(effectiveType);
    } else {
      badge.style.background = '#475569';
    }

    /* Name */
    var nameSpan = document.createElement('span');
    nameSpan.className = 'iv-node-name';
    nameSpan.textContent = name;

    /* Inline connection badge */
    var connBadge = null;
    if (activity.adapterType) {
      connBadge = document.createElement('span');
      connBadge.className = 'iv-conn-badge';
      connBadge.textContent = activity.adapterType;
    }

    /* Inline detail — type-specific */
    var detailSpan = document.createElement('span');
    detailSpan.className = 'iv-node-detail';
    var detailText = '';
    if (!isvirtual) {
      var xp = getActivityXpath(activity);
      if (activity.type === 'ASSIGNMENT') {
        if (xp) detailText = '= ' + truncateXpath(xp);
      } else if (activity.type === 'ROUTER_ROUTE') {
        detailText = xp ? 'IF ' + truncateXpath(xp) : 'OTHERWISE';
      } else if (activity.type === 'FOR_EACH' || activity.type === 'WHILE') {
        if (xp) detailText = truncateXpath(xp);
      } else if (activity.type === 'THROW') {
        if (xp) detailText = 'IF NOT ' + truncateXpath(xp);
      } else if (activity.type === 'INVOKE' || activity.type === 'RECEIVE' || activity.type === 'REPLY') {
        // Show endpoint operation name (e.g. "execute") after the connection name
        if (activity.endpointName && activity.endpointName !== name) {
          detailText = activity.endpointName;
        }
      }
    }
    if (detailText) detailSpan.textContent = detailText;

    /* Child count */
    var childCount = null;
    if (hasChildren) {
      childCount = document.createElement('span');
      childCount.style.cssText = 'font-size:10px;color:var(--iv-text-faint);flex-shrink:0;';
      childCount.textContent = '(' + children.length + ')';
    }

    header.appendChild(toggle);
    header.appendChild(badge);
    header.appendChild(nameSpan);
    if (detailText) header.appendChild(detailSpan);
    if (connBadge) header.appendChild(connBadge);
    if (childCount) header.appendChild(childCount);

    node.appendChild(header);

    /* Breadcrumb */
    if (currentPath.length > 0) {
      var bc = document.createElement('div');
      bc.className = 'iv-breadcrumb';
      bc.textContent = buildBreadcrumb(currentPath);
      node.appendChild(bc);
    }

    /* Detail body — toggled by clicking the header (except on the expand toggle) */
    var detailHtml = isvirtual ? '' : renderDetail(activity);
    var body = null;
    if (detailHtml) {
      body = document.createElement('div');
      body.className = 'iv-node-body';
      body.innerHTML = detailHtml;

      header.style.cursor = 'pointer';
      header.addEventListener('click', function (e) {
        // Don't toggle when clicking the expand/collapse arrow
        if (e.target === toggle) return;
        body.classList.toggle('iv-open');
        header.classList.toggle('iv-header-active');
      });

      node.appendChild(body);
    }

    /* Children container */
    if (hasChildren) {
      var childrenDiv = document.createElement('div');
      childrenDiv.className = 'iv-children';
      childrenDiv.style.display = 'none'; // collapsed by default

      children.forEach(function (child) {
        childrenDiv.appendChild(renderNode(child, depth + 1, currentPath));
      });

      node.appendChild(childrenDiv);

      /* Toggle expand/collapse */
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = childrenDiv.style.display !== 'none';
        childrenDiv.style.display = isOpen ? 'none' : 'block';
        toggle.textContent = isOpen ? '▶' : '▼';
      });
    }

    return node;
  }

  function renderTree() {
    var tc = document.getElementById('iv-tree-container');
    if (!tc) return;
    tc.innerHTML = '';

    if (!blueprintData) {
      showError('No blueprint data available.');
      return;
    }

    var bp = blueprintData;
    var orch = bp.orchestration;
    if (!orch) {
      showError('No orchestration found in blueprint data.');
      return;
    }

    // Collect all global variables, then globalTry activities, then globalTry catchAll
    var rootActivities = [];

    // Global variables
    if (orch.globalVariables && orch.globalVariables.length > 0) {
      orch.globalVariables.forEach(function (gv) {
        if (!gv.type) gv.type = 'GLOBAL_VARIABLE';
        rootActivities.push(gv);
      });
    }

    // Main activities under orchestration.globalTry
    if (orch.globalTry) {
      var gt = orch.globalTry;
      rootActivities.push(gt);
    }

    // Build type filter from collected data
    var allTypes = new Set();
    rootActivities.forEach(function (a) { collectTypes(a, allTypes); });
    // Initialize activeTypeFilters if empty (first load)
    if (activeTypeFilters.size === 0) {
      allTypes.forEach(function (t) { activeTypeFilters.add(t); });
    }
    buildTypeFilter(allTypes);

    // Render
    rootActivities.forEach(function (activity) {
      tc.appendChild(renderNode(activity, 0, []));
    });

  }

  function rerenderTree() {
    var tc = document.getElementById('iv-tree-container');
    if (!tc) return;
    // Preserve search and filter state
    renderTree();
    applyFilters();
  }

  /* ── Type filter ────────────────────────────────────────────────────── */

  function collectTypes(activity, types) {
    var type = activity._virtualType ? activity._virtualType : getEffectiveType(activity);
    if (type) types.add(type);
    var children = [];
    // direct activities
    if (activity.activities) activity.activities.forEach(function (a) { children.push(a); });
    if (activity.catchAll) children.push(activity.catchAll);
    if (activity.catches) activity.catches.forEach(function (a) { children.push(a); });
    if (activity.routes) activity.routes.forEach(function (a) { children.push(a); });
    if (activity.routerRoutes) activity.routerRoutes.forEach(function (a) { children.push(a); });
    children.forEach(function (child) { collectTypes(child, types); });
  }

  function buildTypeFilter(allTypes) {
    var dropdown = document.getElementById('iv-filter-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    // Actions row
    var actions = document.createElement('div');
    actions.className = 'iv-filter-actions';
    var selectAll = document.createElement('a');
    selectAll.textContent = 'Select All';
    selectAll.addEventListener('click', function () {
      allTypes.forEach(function (t) { activeTypeFilters.add(t); });
      var cbs = dropdown.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(function (cb) { cb.checked = true; });
      applyFilters();
    });
    var deselectAll = document.createElement('a');
    deselectAll.textContent = 'Deselect All';
    deselectAll.addEventListener('click', function () {
      activeTypeFilters.clear();
      var cbs = dropdown.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(function (cb) { cb.checked = false; });
      applyFilters();
    });
    actions.appendChild(selectAll);
    actions.appendChild(deselectAll);
    dropdown.appendChild(actions);

    // One item per type
    var typeArray = Array.from(allTypes).sort();
    typeArray.forEach(function (type) {
      var item = document.createElement('label');
      item.className = 'iv-filter-item';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = activeTypeFilters.has(type);
      cb.addEventListener('change', function () {
        if (cb.checked) activeTypeFilters.add(type);
        else activeTypeFilters.delete(type);
        applyFilters();
      });

      var typeBadge = document.createElement('span');
      typeBadge.className = 'iv-filter-badge';
      typeBadge.textContent = getDisplayType(type);
      typeBadge.style.background = getBadgeColor(type);

      var typeLabel = document.createElement('span');
      typeLabel.textContent = type;

      item.appendChild(cb);
      item.appendChild(typeBadge);
      item.appendChild(typeLabel);
      dropdown.appendChild(item);
    });
  }

  function toggleFilterDropdown() {
    var dd = document.getElementById('iv-filter-dropdown');
    if (dd) dd.classList.toggle('open');
  }

  /* ── Search & filter ────────────────────────────────────────────────── */

  function applyFilters() {
    var searchInput = document.getElementById('iv-search-input');
    var searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var tc = document.getElementById('iv-tree-container');
    if (!tc) return;

    // Reset match nav state — rebuild in document order
    searchMatches = [];
    searchCurrentIdx = -1;

    function filterNode(nodeEl) {
      var type = nodeEl._effectiveType || nodeEl._type || '';
      var searchable = nodeEl._searchText || '';

      // Virtual container nodes always pass the type filter
      var typePass = !type || type === 'TRY_BLOCK' || type === 'CATCH_BLOCK' || type === 'FAULTS_BLOCK' ||
        activeTypeFilters.size === 0 || activeTypeFilters.has(type);

      // Check text search
      var textPass = !searchText || searchable.indexOf(searchText) !== -1;

      var selfMatch = typePass && textPass;
      var textHit = searchText && searchable.indexOf(searchText) !== -1;

      // Record this node's slot BEFORE recursing so matches follow document order
      if (selfMatch && textHit) {
        searchMatches.push(nodeEl);
      }

      // Recursively check children
      var childContainer = nodeEl.querySelector(':scope > .iv-children');
      var anyChildVisible = false;
      if (childContainer) {
        for (var i = 0; i < childContainer.children.length; i++) {
          var child = childContainer.children[i];
          if (child.classList && child.classList.contains('iv-node')) {
            if (filterNode(child)) anyChildVisible = true;
          }
        }
      }

      var visible = selfMatch || anyChildVisible;
      nodeEl.classList.toggle('iv-hidden', !visible);

      return visible;
    }

    for (var i = 0; i < tc.children.length; i++) {
      var node = tc.children[i];
      if (node.classList && node.classList.contains('iv-node')) {
        filterNode(node);
      }
    }

    // Highlight matches
    clearHighlights(tc);
    if (searchText) {
      highlightMatches(tc, searchText);
    }

    // Clear any stale current-match marker
    var prevMark = tc.querySelector('.iv-node-header.iv-current-match');
    if (prevMark) prevMark.classList.remove('iv-current-match');

    // Auto-focus first match so Enter-less "type & see" is obvious
    if (searchText && searchMatches.length > 0) {
      searchCurrentIdx = 0;
      focusCurrentMatch(false);
    }

    updateMatchCounter();
  }

  function updateMatchCounter() {
    var matchCountEl = document.getElementById('iv-match-count');
    if (!matchCountEl) return;
    var total = searchMatches.length;
    if (total === 0) {
      var si = document.getElementById('iv-search-input');
      var q = si ? si.value.trim() : '';
      matchCountEl.textContent = q ? '0 matches' : '';
    } else if (searchCurrentIdx >= 0) {
      matchCountEl.textContent = (searchCurrentIdx + 1) + ' / ' + total;
    } else {
      matchCountEl.textContent = total + ' match' + (total !== 1 ? 'es' : '');
    }
    var prev = document.getElementById('iv-search-prev');
    var next = document.getElementById('iv-search-next');
    if (prev) prev.disabled = total === 0;
    if (next) next.disabled = total === 0;
  }

  // Expand every ancestor .iv-children container so the target node becomes visible
  function expandAncestorsOf(nodeEl) {
    var parent = nodeEl.parentNode;
    while (parent && parent.id !== 'iv-tree-container') {
      if (parent.classList && parent.classList.contains('iv-children')) {
        parent.style.display = 'block';
        // Flip sibling toggle glyph on the owning node's header
        var ownerNode = parent.parentNode;
        if (ownerNode) {
          var tog = ownerNode.querySelector(':scope > .iv-node-header > .iv-toggle');
          if (tog && !tog.classList.contains('iv-leaf')) tog.textContent = '▼';
        }
      }
      parent = parent.parentNode;
    }
  }

  function focusCurrentMatch(smoothScroll) {
    if (searchCurrentIdx < 0 || searchCurrentIdx >= searchMatches.length) return;
    var tc = document.getElementById('iv-tree-container');
    if (!tc) return;

    // Remove previous marker
    var prev = tc.querySelector('.iv-node-header.iv-current-match');
    if (prev) prev.classList.remove('iv-current-match');

    var nodeEl = searchMatches[searchCurrentIdx];
    expandAncestorsOf(nodeEl);
    var header = nodeEl.querySelector(':scope > .iv-node-header');
    if (header) {
      header.classList.add('iv-current-match');
      header.scrollIntoView({ behavior: smoothScroll ? 'smooth' : 'auto', block: 'center' });
    }
  }

  function navigateToMatch(direction) {
    if (searchMatches.length === 0) return;
    if (searchCurrentIdx < 0) {
      searchCurrentIdx = direction === 'prev' ? searchMatches.length - 1 : 0;
    } else if (direction === 'next') {
      searchCurrentIdx = (searchCurrentIdx + 1) % searchMatches.length;
    } else {
      searchCurrentIdx = (searchCurrentIdx - 1 + searchMatches.length) % searchMatches.length;
    }
    focusCurrentMatch(true);
    updateMatchCounter();
  }

  function highlightMatches(container, searchText) {
    if (!searchText) return;
    var walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          // Skip script/style and already-highlighted spans
          if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          if (parent.classList && parent.classList.contains('iv-search-match')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    var nodesToProcess = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.toLowerCase().indexOf(searchText) !== -1) {
        nodesToProcess.push(node);
      }
    }

    nodesToProcess.forEach(function (textNode) {
      var val = textNode.nodeValue;
      var lval = val.toLowerCase();
      var idx = lval.indexOf(searchText);
      if (idx === -1) return;

      var frag = document.createDocumentFragment();
      var lastIndex = 0;

      while (idx !== -1) {
        if (idx > lastIndex) {
          frag.appendChild(document.createTextNode(val.slice(lastIndex, idx)));
        }
        var mark = document.createElement('span');
        mark.className = 'iv-search-match';
        mark.textContent = val.slice(idx, idx + searchText.length);
        frag.appendChild(mark);
        lastIndex = idx + searchText.length;
        idx = lval.indexOf(searchText, lastIndex);
      }

      if (lastIndex < val.length) {
        frag.appendChild(document.createTextNode(val.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function clearHighlights(container) {
    var marks = container.querySelectorAll('.iv-search-match');
    marks.forEach(function (mark) {
      var parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    });
  }

  /* ── Expand / Collapse ──────────────────────────────────────────────── */

  function expandCollapseAll(expand) {
    var tc = document.getElementById('iv-tree-container');
    if (!tc) return;

    var childContainers = tc.querySelectorAll('.iv-children');
    var toggles = tc.querySelectorAll('.iv-toggle:not(.iv-leaf)');

    childContainers.forEach(function (c) {
      c.style.display = expand ? 'block' : 'none';
    });
    toggles.forEach(function (t) {
      t.textContent = expand ? '▼' : '▶';
    });
  }

  /* ── Export ─────────────────────────────────────────────────────────── */

  function exportJson() {
    if (!blueprintData) return;
    var json = JSON.stringify(blueprintData, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(blueprintData.code || 'integration') + '_' + sanitizeFilename(blueprintData.version || 'export') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportHtml() {
    if (!blueprintData) return;

    /* ── 1. Fetch full content.css from the extension ── */
    var cssUrl = chrome.runtime.getURL('content.css');
    fetch(cssUrl)
      .then(function (r) { return r.text(); })
      .catch(function () { return ''; })
      .then(function (cssText) { buildExportHtml(cssText); });
  }

  function buildExportHtml(cssText) {
    if (!blueprintData) return;

    /* ── 2. Embed data ── */
    var dataJson = JSON.stringify(blueprintData);

    var bp = blueprintData;
    var title = (bp.name || bp.code || 'Integration') + ' - ' + (bp.code || '') + ' v' + (bp.version || '');

    /* ── 3. Build the standalone HTML ── */
    var html = '<!DOCTYPE html>\n' +
      '<html>\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<title>' + escapeHtml(bp.name || bp.code || 'Integration') + ' \u2014 ' + escapeHtml(bp.code || '') + ' v' + escapeHtml(bp.version || '') + '</title>\n' +
      '<style>\n' +
      'body { margin: 0; padding: 0; }\n' +
      cssText + '\n' +
      '#oic-iv-overlay { position: relative !important; min-height: 100vh; }\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      '<div id="oic-iv-overlay" data-theme="' + currentTheme + '">\n' +
      '  <div class="iv-header">\n' +
      '    <h2>OIC Integration Viewer</h2>\n' +
      '    <span class="iv-meta">' + escapeHtml(bp.name || '') + (bp.name ? ' \u2014 ' : '') + escapeHtml(bp.code || '') + ' v' + escapeHtml(bp.version || '') + (bp.description ? ' \u2014 ' + escapeHtml(bp.description) : '') + '</span>\n' +
      '    <select class="iv-theme-select" id="iv-theme-select">\n' +
      '      <option value="light">Light</option>\n' +
      '      <option value="dark">Dark</option>\n' +
      '      <option value="high-contrast">High Contrast</option>\n' +
      '      <option value="solarized">Solarized</option>\n' +
      '    </select>\n' +
      '  </div>\n' +
      '  <div class="iv-toolbar">\n' +
      '    <input type="search" id="iv-search-input" placeholder="Search activities\u2026">\n' +
      '    <span class="iv-match-count" id="iv-match-count"></span>\n' +
      '    <div class="iv-filter-container">\n' +
      '      <button id="iv-filter-btn">\u2699 Filter Types</button>\n' +
      '      <div class="iv-filter-dropdown" id="iv-filter-dropdown"></div>\n' +
      '    </div>\n' +
      '    <button id="iv-expand-btn">\u229e Expand All</button>\n' +
      '    <button id="iv-collapse-btn">\u229f Collapse All</button>\n' +
      '  </div>\n' +
      '  <div class="iv-tree-container" id="iv-tree-container"></div>\n' +
      '</div>\n' +
      '<script>\n' +
      '(function() {\n' +
      '"use strict";\n' +
      '\n' +
      'var blueprintData = ' + dataJson + ';\n' +
      'var currentTheme = ' + JSON.stringify(currentTheme) + ';\n' +
      'var colorOverrides = ' + JSON.stringify(colorOverrides) + ';\n' +
      'var activeTypeFilters = {}; // used as a set via keys\n' +
      '\n' +
      'var DEFAULT_COLORS = ' + JSON.stringify(DEFAULT_COLORS) + ';\n' +
      '\n' +
      'var TYPE_DISPLAY = ' + JSON.stringify(TYPE_DISPLAY) + ';\n' +
      '\n' +
      'function getBadgeColor(type) {\n' +
      '  var themeOverrides = colorOverrides[currentTheme];\n' +
      '  if (themeOverrides && themeOverrides[type]) return themeOverrides[type];\n' +
      '  var themeDefaults = DEFAULT_COLORS[currentTheme] || DEFAULT_COLORS.light;\n' +
      '  return themeDefaults[type] || "#6b7280";\n' +
      '}\n' +
      '\n' +
      'function getDisplayType(type) {\n' +
      '  return TYPE_DISPLAY[type] || type;\n' +
      '}\n' +
      '\n' +
      'function escapeHtml(str) {\n' +
      '  if (!str) return "";\n' +
      '  var div = document.createElement("div");\n' +
      '  div.textContent = String(str);\n' +
      '  return div.innerHTML;\n' +
      '}\n' +
      '\n' +
      'function debounce(fn, ms) {\n' +
      '  var timer;\n' +
      '  return function() {\n' +
      '    var args = arguments, ctx = this;\n' +
      '    clearTimeout(timer);\n' +
      '    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);\n' +
      '  };\n' +
      '}\n' +
      '\n' +
      'function getActivityName(activity) {\n' +
      '  var t = activity.type;\n' +
      '  if (t === "INVOKE" || t === "RECEIVE" || t === "REPLY" || t === "PUBLISHER") {\n' +
      '    if (activity.connectionName) return activity.connectionName;\n' +
      '  }\n' +
      '  if (t === "TRANSFORMER" && activity.mappedTarget && activity.mappedTarget.name) return activity.mappedTarget.name;\n' +
      '  return activity.endpointName || activity.name || activity.faultName || activity.variableName || activity.id || "(unnamed)";\n' +
      '}\n' +
      '\n' +
      'function getChildren(activity) {\n' +
      '  var type = activity.type || activity._virtualType || "";\n' +
      '  var children = [];\n' +
      '  if (type === "TRY" || type === "GLOBAL_TRY") {\n' +
      '    children.push({ _virtualType: "TRY_BLOCK", _label: "Main", activities: activity.activities || [] });\n' +
      '    var hasCatches = activity.catches && activity.catches.length > 0;\n' +
      '    var hasCatchAll = !!activity.catchAll;\n' +
      '    if (hasCatches || hasCatchAll) {\n' +
      '      var fc = [];\n' +
      '      if (hasCatches) { for (var ci = 0; ci < activity.catches.length; ci++) fc.push(activity.catches[ci]); }\n' +
      '      if (hasCatchAll) fc.push(activity.catchAll);\n' +
      '      children.push({ _virtualType: "FAULTS_BLOCK", _label: "Faults", activities: fc });\n' +
      '    }\n' +
      '  } else if (type === "ROUTER") {\n' +
      '    var routes = activity.routes || activity.routerRoutes || [];\n' +
      '    for (var i = 0; i < routes.length; i++) children.push(routes[i]);\n' +
      '  } else if (type === "TRY_BLOCK" || type === "FAULTS_BLOCK") {\n' +
      '    var acts = activity.activities || [];\n' +
      '    for (var i = 0; i < acts.length; i++) children.push(acts[i]);\n' +
      '  } else {\n' +
      '    var acts2 = activity.activities || [];\n' +
      '    for (var i = 0; i < acts2.length; i++) children.push(acts2[i]);\n' +
      '  }\n' +
      '  return children;\n' +
      '}\n' +
      '\n' +
      'function buildBreadcrumb(path) {\n' +
      '  return path.join(" \u203a ");\n' +
      '}\n' +
      '\n' +
      'function getSearchableText(activity) {\n' +
      '  var parts = [\n' +
      '    activity.type || "", activity.name || "", activity.endpointName || "",\n' +
      '    activity.variableName || "", activity.variableDescription || "",\n' +
      '    activity.id || "", activity.refUri || "", activity.faultName || "",\n' +
      '    activity.connectionId || "", activity.connectionName || "", activity.connectionTypeName || "",\n' +
      '    activity.adapterType || "", activity.mep || "", activity.endpointMEP || "", activity.binding || "",\n' +
      '    activity.condition || "", activity.expression || "", activity.xpathExpression || "",\n' +
      '    activity.description || "", getDisplayType(activity.type || "")\n' +
      '  ];\n' +
      '  if (activity.mappedTarget && activity.mappedTarget.name) parts.push(activity.mappedTarget.name);\n' +
      '  if (activity._archiveDetail) {\n' +
      '    var ad = activity._archiveDetail;\n' +
      '    if (ad.expression) {\n' +
      '      if (ad.expression.TextExpression) parts.push(ad.expression.TextExpression);\n' +
      '      if (ad.expression.XpathExpression) parts.push(ad.expression.XpathExpression);\n' +
      '      if (ad.expression.VariableName) parts.push(ad.expression.VariableName);\n' +
      '      if (ad.expression.VariableType) parts.push(ad.expression.VariableType);\n' +
      '      if (ad.expression.VariableDescription) parts.push(ad.expression.VariableDescription);\n' +
      '    }\n' +
      '    if (ad.files) { var keys = Object.keys(ad.files); for (var i = 0; i < keys.length; i++) { parts.push(keys[i]); parts.push(ad.files[keys[i]]); } }\n' +
      '  }\n' +
      '  return parts.join(" ").toLowerCase();\n' +
      '}\n' +
      '\n' +
      'function renderDetail(activity) {\n' +
      '  var rows = [];\n' +
      '  function addRow(label, value) {\n' +
      '    if (value == null || value === "" || value === false) return;\n' +
      '    rows.push("<div class=\\"iv-detail-row\\"><span class=\\"iv-detail-label\\">" + escapeHtml(label) + "</span><span class=\\"iv-detail-value\\">" + escapeHtml(String(value)) + "</span></div>");\n' +
      '  }\n' +
      '  addRow("Type", activity.type);\n' +
      '  addRow("ID", activity.id);\n' +
      '  addRow("Name", activity.name);\n' +
      '  addRow("Endpoint Name", activity.endpointName);\n' +
      '  addRow("Variable Name", activity.variableName);\n' +
      '  addRow("Connection ID", activity.connectionId);\n' +
      '  addRow("Adapter Type", activity.adapterType);\n' +
      '  addRow("MEP", activity.mep);\n' +
      '  addRow("Request Endpoint", activity.requestEndpoint);\n' +
      '  addRow("Response Endpoint", activity.responseEndpoint);\n' +
      '  addRow("Condition", activity.condition);\n' +
      '  addRow("Expression", activity.expression);\n' +
      '  addRow("XPath", activity.xpathExpression);\n' +
      '  addRow("Mapping", activity.mappingName || activity.mapName);\n' +
      '  if (activity.variableType) { var vt = activity.variableType; addRow("Variable Type", vt.elementName + (vt.variableTypeClass ? " (" + vt.variableTypeClass + ")" : "")); }\n' +
      '  addRow("Description", activity.description);\n' +
      '  if (activity.configured != null) addRow("Configured", activity.configured ? "Yes" : "No");\n' +
      '  if (activity._archiveDetail) {\n' +
      '    var ad = activity._archiveDetail;\n' +
      '    if (ad.expression) {\n' +
      '      if (ad.expression.TextExpression) addRow("Expression", ad.expression.TextExpression);\n' +
      '      if (ad.expression.XpathExpression) addRow("XPath", ad.expression.XpathExpression);\n' +
      '      if (ad.expression.VariableType) addRow("Var Type", ad.expression.VariableType);\n' +
      '    }\n' +
      '    if (ad.nxsd) {\n' +
      '      if (ad.nxsd.fileName) addRow("Sample File", ad.nxsd.fileName);\n' +
      '      if (ad.nxsd.rootElement) addRow("Root Element", ad.nxsd.rootElement);\n' +
      '      if (ad.nxsd.schemaType) addRow("Schema Type", ad.nxsd.schemaType);\n' +
      '    }\n' +
      '    if (ad.files) {\n' +
      '      var paths = Object.keys(ad.files);\n' +
      '      for (var fi = 0; fi < paths.length; fi++) {\n' +
      '        var p = paths[fi]; var content = ad.files[p];\n' +
      '        rows.push("<div class=\\"iv-detail-row\\"><span class=\\"iv-detail-label\\">File</span><span class=\\"iv-detail-value\\">" + escapeHtml(p) + "</span><button class=\\"iv-fullscreen-btn\\" title=\\"Copy to clipboard\\" data-file-action=\\"copy\\" data-file-path=\\"" + escapeHtml(p) + "\\">\ud83d\udccb</button><button class=\\"iv-fullscreen-btn\\" title=\\"Download\\" data-file-action=\\"download\\" data-file-path=\\"" + escapeHtml(p) + "\\">\u2b07</button><button class=\\"iv-fullscreen-btn\\" title=\\"Fullscreen\\" data-file-path=\\"" + escapeHtml(p) + "\\">\u26F6</button></div><pre class=\\"iv-archive-file\\">" + escapeHtml(content) + "</pre>");\n' +
      '      }\n' +
      '    }\n' +
      '  }\n' +
      '  return rows.join("");\n' +
      '}\n' +
      '\n' +
      'function renderNode(activity, depth, parentPath) {\n' +
      '  depth = depth || 0;\n' +
      '  parentPath = parentPath || [];\n' +
      '  var type = activity.type || activity._virtualType || "UNKNOWN";\n' +
      '  var isvirtual = !!activity._virtualType;\n' +
      '  var name = isvirtual ? (activity._label || type) : getActivityName(activity);\n' +
      '  var displayType = isvirtual ? (activity._label || type) : getDisplayType(type);\n' +
      '  var children = getChildren(activity);\n' +
      '  var hasChildren = children.length > 0;\n' +
      '  var currentPath = parentPath.concat([name]);\n' +
      '  var searchText = isvirtual ? name.toLowerCase() : getSearchableText(activity);\n' +
      '\n' +
      '  var node = document.createElement("div");\n' +
      '  node.className = "iv-node";\n' +
      '  node._activityData = activity;\n' +
      '  node._searchText = searchText;\n' +
      '  node._type = type;\n' +
      '\n' +
      '  var header = document.createElement("div");\n' +
      '  header.className = "iv-node-header";\n' +
      '\n' +
      '  var toggle = document.createElement("span");\n' +
      '  toggle.className = "iv-toggle" + (hasChildren ? "" : " iv-leaf");\n' +
      '  toggle.textContent = hasChildren ? "\u25b6" : "\u00b7";\n' +
      '\n' +
      '  var badge = document.createElement("span");\n' +
      '  badge.className = "iv-type-badge";\n' +
      '  badge.textContent = displayType;\n' +
      '  badge.style.background = isvirtual ? "#475569" : getBadgeColor(type);\n' +
      '\n' +
      '  var nameSpan = document.createElement("span");\n' +
      '  nameSpan.className = "iv-node-name";\n' +
      '  nameSpan.textContent = name;\n' +
      '\n' +
      '  var connBadge = null;\n' +
      '  if (activity.adapterType) {\n' +
      '    connBadge = document.createElement("span");\n' +
      '    connBadge.className = "iv-conn-badge";\n' +
      '    connBadge.textContent = activity.adapterType;\n' +
      '  }\n' +
      '\n' +
      '  var detailSpan = document.createElement("span");\n' +
      '  detailSpan.className = "iv-node-detail";\n' +
      '  var detailParts = [];\n' +
      '  if (activity.connectionId) detailParts.push(activity.connectionId);\n' +
      '  if (activity.condition) detailParts.push(activity.condition);\n' +
      '  if (activity.expression) detailParts.push(activity.expression);\n' +
      '  if (activity.mappingName || activity.mapName) detailParts.push(activity.mappingName || activity.mapName);\n' +
      '  if (detailParts.length > 0) detailSpan.textContent = detailParts.join(" \u00b7 ");\n' +
      '\n' +
      '  var childCount = null;\n' +
      '  if (hasChildren) {\n' +
      '    childCount = document.createElement("span");\n' +
      '    childCount.style.cssText = "font-size:10px;color:var(--iv-text-faint);flex-shrink:0;";\n' +
      '    childCount.textContent = "(" + children.length + ")";\n' +
      '  }\n' +
      '\n' +
      '  header.appendChild(toggle);\n' +
      '  header.appendChild(badge);\n' +
      '  header.appendChild(nameSpan);\n' +
      '  if (connBadge) header.appendChild(connBadge);\n' +
      '  if (detailParts.length > 0) header.appendChild(detailSpan);\n' +
      '  if (childCount) header.appendChild(childCount);\n' +
      '  node.appendChild(header);\n' +
      '\n' +
      '  if (currentPath.length > 0) {\n' +
      '    var bc = document.createElement("div");\n' +
      '    bc.className = "iv-breadcrumb";\n' +
      '    bc.textContent = buildBreadcrumb(currentPath);\n' +
      '    node.appendChild(bc);\n' +
      '  }\n' +
      '\n' +
      '  var detailHtml = isvirtual ? "" : renderDetail(activity);\n' +
      '  if (detailHtml) {\n' +
      '    var body = document.createElement("div");\n' +
      '    body.className = "iv-node-body";\n' +
      '    body.innerHTML = detailHtml;\n' +
      '    header.style.cursor = "pointer";\n' +
      '    (function(hdr, bod) {\n' +
      '      hdr.addEventListener("click", function(e) {\n' +
      '        if (e.target === toggle) return;\n' +
      '        bod.classList.toggle("iv-open");\n' +
      '      });\n' +
      '    })(header, body);\n' +
      '    node.appendChild(body);\n' +
      '  }\n' +
      '\n' +
      '  if (hasChildren) {\n' +
      '    var childrenDiv = document.createElement("div");\n' +
      '    childrenDiv.className = "iv-children";\n' +
      '    childrenDiv.style.display = "none";\n' +
      '    for (var ci = 0; ci < children.length; ci++) {\n' +
      '      childrenDiv.appendChild(renderNode(children[ci], depth + 1, currentPath));\n' +
      '    }\n' +
      '    node.appendChild(childrenDiv);\n' +
      '    (function(tog, cdiv) {\n' +
      '      tog.addEventListener("click", function(e) {\n' +
      '        e.stopPropagation();\n' +
      '        var isOpen = cdiv.style.display !== "none";\n' +
      '        cdiv.style.display = isOpen ? "none" : "block";\n' +
      '        tog.textContent = isOpen ? "\u25b6" : "\u25bc";\n' +
      '      });\n' +
      '    })(toggle, childrenDiv);\n' +
      '  }\n' +
      '  return node;\n' +
      '}\n' +
      '\n' +
      'function collectTypes(activity, typesObj) {\n' +
      '  var type = activity.type || activity._virtualType;\n' +
      '  if (type) typesObj[type] = true;\n' +
      '  var sub = [];\n' +
      '  if (activity.activities) for (var i = 0; i < activity.activities.length; i++) sub.push(activity.activities[i]);\n' +
      '  if (activity.catchAll) sub.push(activity.catchAll);\n' +
      '  if (activity.catches) for (var i = 0; i < activity.catches.length; i++) sub.push(activity.catches[i]);\n' +
      '  if (activity.routes) for (var i = 0; i < activity.routes.length; i++) sub.push(activity.routes[i]);\n' +
      '  if (activity.routerRoutes) for (var i = 0; i < activity.routerRoutes.length; i++) sub.push(activity.routerRoutes[i]);\n' +
      '  for (var i = 0; i < sub.length; i++) collectTypes(sub[i], typesObj);\n' +
      '}\n' +
      '\n' +
      'function buildTypeFilter(allTypesObj) {\n' +
      '  var dropdown = document.getElementById("iv-filter-dropdown");\n' +
      '  if (!dropdown) return;\n' +
      '  dropdown.innerHTML = "";\n' +
      '  var typeArray = Object.keys(allTypesObj).sort();\n' +
      '  var actions = document.createElement("div");\n' +
      '  actions.className = "iv-filter-actions";\n' +
      '  var selectAll = document.createElement("a");\n' +
      '  selectAll.textContent = "Select All";\n' +
      '  selectAll.addEventListener("click", function() {\n' +
      '    for (var i = 0; i < typeArray.length; i++) activeTypeFilters[typeArray[i]] = true;\n' +
      '    var cbs = dropdown.querySelectorAll("input[type=checkbox]");\n' +
      '    for (var i = 0; i < cbs.length; i++) cbs[i].checked = true;\n' +
      '    applyFilters();\n' +
      '  });\n' +
      '  var deselectAll = document.createElement("a");\n' +
      '  deselectAll.textContent = "Deselect All";\n' +
      '  deselectAll.addEventListener("click", function() {\n' +
      '    activeTypeFilters = {};\n' +
      '    var cbs = dropdown.querySelectorAll("input[type=checkbox]");\n' +
      '    for (var i = 0; i < cbs.length; i++) cbs[i].checked = false;\n' +
      '    applyFilters();\n' +
      '  });\n' +
      '  actions.appendChild(selectAll);\n' +
      '  actions.appendChild(deselectAll);\n' +
      '  dropdown.appendChild(actions);\n' +
      '  for (var ti = 0; ti < typeArray.length; ti++) {\n' +
      '    (function(type) {\n' +
      '      var item = document.createElement("label");\n' +
      '      item.className = "iv-filter-item";\n' +
      '      var cb = document.createElement("input");\n' +
      '      cb.type = "checkbox";\n' +
      '      cb.checked = !!activeTypeFilters[type];\n' +
      '      cb.addEventListener("change", function() {\n' +
      '        if (cb.checked) activeTypeFilters[type] = true;\n' +
      '        else delete activeTypeFilters[type];\n' +
      '        applyFilters();\n' +
      '      });\n' +
      '      var typeBadge = document.createElement("span");\n' +
      '      typeBadge.className = "iv-filter-badge";\n' +
      '      typeBadge.textContent = getDisplayType(type);\n' +
      '      typeBadge.style.background = getBadgeColor(type);\n' +
      '      var typeLabel = document.createElement("span");\n' +
      '      typeLabel.textContent = type;\n' +
      '      item.appendChild(cb);\n' +
      '      item.appendChild(typeBadge);\n' +
      '      item.appendChild(typeLabel);\n' +
      '      dropdown.appendChild(item);\n' +
      '    })(typeArray[ti]);\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'function toggleFilterDropdown() {\n' +
      '  var dd = document.getElementById("iv-filter-dropdown");\n' +
      '  if (dd) dd.classList.toggle("open");\n' +
      '}\n' +
      '\n' +
      'function applyFilters() {\n' +
      '  var searchInput = document.getElementById("iv-search-input");\n' +
      '  var searchText = searchInput ? searchInput.value.trim().toLowerCase() : "";\n' +
      '  var matchCountEl = document.getElementById("iv-match-count");\n' +
      '  var tc = document.getElementById("iv-tree-container");\n' +
      '  if (!tc) return;\n' +
      '  var matchCount = 0;\n' +
      '  var filterKeys = Object.keys(activeTypeFilters);\n' +
      '  function filterNode(nodeEl) {\n' +
      '    var type = nodeEl._type || "";\n' +
      '    var searchable = nodeEl._searchText || "";\n' +
      '    var typePass = !type || type === "TRY_BLOCK" || type === "CATCH_BLOCK" || type === "FAULTS_BLOCK" ||\n' +
      '                   filterKeys.length === 0 || !!activeTypeFilters[type];\n' +
      '    var textPass = !searchText || searchable.indexOf(searchText) !== -1;\n' +
      '    var childContainer = nodeEl.querySelector(":scope > .iv-children");\n' +
      '    var anyChildVisible = false;\n' +
      '    if (childContainer) {\n' +
      '      for (var i = 0; i < childContainer.children.length; i++) {\n' +
      '        var child = childContainer.children[i];\n' +
      '        if (child.classList && child.classList.contains("iv-node")) {\n' +
      '          if (filterNode(child)) anyChildVisible = true;\n' +
      '        }\n' +
      '      }\n' +
      '    }\n' +
      '    var selfMatch = typePass && textPass;\n' +
      '    var visible = selfMatch || anyChildVisible;\n' +
      '    nodeEl.classList.toggle("iv-hidden", !visible);\n' +
      '    if (selfMatch && searchText && searchable.indexOf(searchText) !== -1) matchCount++;\n' +
      '    return visible;\n' +
      '  }\n' +
      '  for (var i = 0; i < tc.children.length; i++) {\n' +
      '    var node = tc.children[i];\n' +
      '    if (node.classList && node.classList.contains("iv-node")) filterNode(node);\n' +
      '  }\n' +
      '  clearHighlights(tc);\n' +
      '  if (searchText) highlightMatches(tc, searchText);\n' +
      '  if (matchCountEl) matchCountEl.textContent = searchText ? matchCount + " match" + (matchCount !== 1 ? "es" : "") : "";\n' +
      '}\n' +
      '\n' +
      'function highlightMatches(container, searchText) {\n' +
      '  if (!searchText) return;\n' +
      '  var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {\n' +
      '    acceptNode: function(node) {\n' +
      '      var parent = node.parentElement;\n' +
      '      if (!parent) return NodeFilter.FILTER_REJECT;\n' +
      '      if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") return NodeFilter.FILTER_REJECT;\n' +
      '      if (parent.classList && parent.classList.contains("iv-search-match")) return NodeFilter.FILTER_REJECT;\n' +
      '      return NodeFilter.FILTER_ACCEPT;\n' +
      '    }\n' +
      '  }, false);\n' +
      '  var nodesToProcess = [];\n' +
      '  var node;\n' +
      '  while ((node = walker.nextNode())) {\n' +
      '    if (node.nodeValue && node.nodeValue.toLowerCase().indexOf(searchText) !== -1) nodesToProcess.push(node);\n' +
      '  }\n' +
      '  for (var ni = 0; ni < nodesToProcess.length; ni++) {\n' +
      '    var textNode = nodesToProcess[ni];\n' +
      '    var val = textNode.nodeValue;\n' +
      '    var lval = val.toLowerCase();\n' +
      '    var idx = lval.indexOf(searchText);\n' +
      '    if (idx === -1) continue;\n' +
      '    var frag = document.createDocumentFragment();\n' +
      '    var lastIndex = 0;\n' +
      '    while (idx !== -1) {\n' +
      '      if (idx > lastIndex) frag.appendChild(document.createTextNode(val.slice(lastIndex, idx)));\n' +
      '      var mark = document.createElement("span");\n' +
      '      mark.className = "iv-search-match";\n' +
      '      mark.textContent = val.slice(idx, idx + searchText.length);\n' +
      '      frag.appendChild(mark);\n' +
      '      lastIndex = idx + searchText.length;\n' +
      '      idx = lval.indexOf(searchText, lastIndex);\n' +
      '    }\n' +
      '    if (lastIndex < val.length) frag.appendChild(document.createTextNode(val.slice(lastIndex)));\n' +
      '    textNode.parentNode.replaceChild(frag, textNode);\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'function clearHighlights(container) {\n' +
      '  var marks = container.querySelectorAll(".iv-search-match");\n' +
      '  for (var i = 0; i < marks.length; i++) {\n' +
      '    var mark = marks[i];\n' +
      '    var parent = mark.parentNode;\n' +
      '    if (parent) {\n' +
      '      parent.replaceChild(document.createTextNode(mark.textContent), mark);\n' +
      '      parent.normalize();\n' +
      '    }\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'function expandCollapseAll(expand) {\n' +
      '  var tc = document.getElementById("iv-tree-container");\n' +
      '  if (!tc) return;\n' +
      '  var childContainers = tc.querySelectorAll(".iv-children");\n' +
      '  var toggles = tc.querySelectorAll(".iv-toggle:not(.iv-leaf)");\n' +
      '  for (var i = 0; i < childContainers.length; i++) childContainers[i].style.display = expand ? "block" : "none";\n' +
      '  for (var i = 0; i < toggles.length; i++) toggles[i].textContent = expand ? "\u25bc" : "\u25b6";\n' +
      '}\n' +
      '\n' +
      'function renderTree() {\n' +
      '  var tc = document.getElementById("iv-tree-container");\n' +
      '  if (!tc) return;\n' +
      '  tc.innerHTML = "";\n' +
      '  if (!blueprintData || !blueprintData.orchestration) return;\n' +
      '  var orch = blueprintData.orchestration;\n' +
      '  var rootActivities = [];\n' +
      '  if (orch.globalVariables && orch.globalVariables.length > 0) {\n' +
      '    for (var i = 0; i < orch.globalVariables.length; i++) {\n' +
      '      var gv = orch.globalVariables[i];\n' +
      '      if (!gv.type) gv.type = "GLOBAL_VARIABLE";\n' +
      '      rootActivities.push(gv);\n' +
      '    }\n' +
      '  }\n' +
      '  if (orch.globalTry) {\n' +
      '    rootActivities.push(orch.globalTry);\n' +
      '  }\n' +
      '  var allTypes = {};\n' +
      '  for (var i = 0; i < rootActivities.length; i++) collectTypes(rootActivities[i], allTypes);\n' +
      '  if (Object.keys(activeTypeFilters).length === 0) {\n' +
      '    var keys = Object.keys(allTypes);\n' +
      '    for (var i = 0; i < keys.length; i++) activeTypeFilters[keys[i]] = true;\n' +
      '  }\n' +
      '  buildTypeFilter(allTypes);\n' +
      '  for (var i = 0; i < rootActivities.length; i++) {\n' +
      '    tc.appendChild(renderNode(rootActivities[i], 0, []));\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'function applyTheme(themeId) {\n' +
      '  currentTheme = themeId;\n' +
      '  var ov = document.getElementById("oic-iv-overlay");\n' +
      '  if (ov) ov.setAttribute("data-theme", themeId);\n' +
      '}\n' +
      '\n' +
      '// Set initial theme select value\n' +
      'window.addEventListener("DOMContentLoaded", function() {\n' +
      '  var sel = document.getElementById("iv-theme-select");\n' +
      '  if (sel) sel.value = currentTheme;\n' +
      '});\n' +
      '\n' +
      '// Event listeners\n' +
      'document.addEventListener("DOMContentLoaded", function() {\n' +
      '  var sel = document.getElementById("iv-theme-select");\n' +
      '  if (sel) {\n' +
      '    sel.value = currentTheme;\n' +
      '    sel.addEventListener("change", function() {\n' +
      '      applyTheme(sel.value);\n' +
      '      renderTree();\n' +
      '      applyFilters();\n' +
      '    });\n' +
      '  }\n' +
      '\n' +
      '  var searchInput = document.getElementById("iv-search-input");\n' +
      '  if (searchInput) searchInput.addEventListener("input", debounce(applyFilters, 200));\n' +
      '\n' +
      '  var filterBtn = document.getElementById("iv-filter-btn");\n' +
      '  if (filterBtn) filterBtn.addEventListener("click", function(e) { e.stopPropagation(); toggleFilterDropdown(); });\n' +
      '\n' +
      '  var expandBtn = document.getElementById("iv-expand-btn");\n' +
      '  if (expandBtn) expandBtn.addEventListener("click", function() { expandCollapseAll(true); });\n' +
      '\n' +
      '  var collapseBtn = document.getElementById("iv-collapse-btn");\n' +
      '  if (collapseBtn) collapseBtn.addEventListener("click", function() { expandCollapseAll(false); });\n' +
      '\n' +
      '  document.addEventListener("click", function(e) {\n' +
      '    var dd = document.getElementById("iv-filter-dropdown");\n' +
      '    if (dd && dd.classList.contains("open")) {\n' +
      '      var fc = dd.parentElement;\n' +
      '      if (fc && !fc.contains(e.target)) dd.classList.remove("open");\n' +
      '    }\n' +
      '    var fsBtn = e.target && e.target.closest && e.target.closest(".iv-fullscreen-btn");\n' +
      '    if (fsBtn) {\n' +
      '      e.stopPropagation();\n' +
      '      var row = fsBtn.closest(".iv-detail-row");\n' +
      '      var pre = row && row.nextElementSibling;\n' +
      '      if (!pre || !pre.classList.contains("iv-archive-file")) return;\n' +
      '      var path = fsBtn.getAttribute("data-file-path") || "file";\n' +
      '      var content = pre.textContent;\n' +
      '      var action = fsBtn.getAttribute("data-file-action");\n' +
      '      if (action === "copy") { copyToClipboard(content, fsBtn); }\n' +
      '      else if (action === "download") { downloadText(content, path); }\n' +
      '      else { openFullscreenViewer(path, content); }\n' +
      '    }\n' +
      '  });\n' +
      '\n' +
      '  function copyToClipboard(text, srcBtn) {\n' +
      '    function flash(ok) { if (!srcBtn) return; var o = srcBtn.textContent, ot = srcBtn.title; srcBtn.textContent = ok ? "\u2713" : "\u2715"; srcBtn.title = ok ? "Copied" : "Copy failed"; setTimeout(function(){ srcBtn.textContent = o; srcBtn.title = ot; }, 1200); }\n' +
      '    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function(){flash(true);}, function(){fallback();}); } else { fallback(); }\n' +
      '    function fallback() { try { var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); var ok = document.execCommand("copy"); document.body.removeChild(ta); flash(ok); } catch(e) { flash(false); } }\n' +
      '  }\n' +
      '  function downloadText(text, path) { var parts = String(path||"file").split("/"); var name = (parts[parts.length-1]||"file").replace(/[^a-zA-Z0-9_.-]/g, "_"); var blob = new Blob([text], {type:"text/plain;charset=utf-8"}); var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }\n' +
      '\n' +
      '  function openFullscreenViewer(path, content) {\n' +
      '    var existing = document.getElementById("oic-iv-fullscreen");\n' +
      '    if (existing) existing.remove();\n' +
      '    var fs = document.createElement("div"); fs.id = "oic-iv-fullscreen"; fs.setAttribute("data-theme", overlay.getAttribute("data-theme") || "light");\n' +
      '    var header = document.createElement("div"); header.className = "iv-fs-header";\n' +
      '    var title = document.createElement("span"); title.className = "iv-fs-title"; title.textContent = path;\n' +
      '    var closeBtn = document.createElement("button"); closeBtn.className = "iv-fs-close"; closeBtn.textContent = "\u2715 Close";\n' +
      '    var body = document.createElement("pre"); body.className = "iv-fs-body"; body.textContent = content;\n' +
      '    function closeFs() { document.removeEventListener("keydown", escH); fs.remove(); }\n' +
      '    function escH(e) { if (e.key === "Escape") { e.stopPropagation(); closeFs(); } }\n' +
      '    closeBtn.addEventListener("click", closeFs);\n' +
      '    document.addEventListener("keydown", escH);\n' +
      '    var copyBtn = document.createElement("button"); copyBtn.className = "iv-fs-action"; copyBtn.textContent = "\ud83d\udccb Copy"; copyBtn.title = "Copy to clipboard"; copyBtn.addEventListener("click", function(){ copyToClipboard(content, copyBtn); });\n' +
      '    var dlBtn = document.createElement("button"); dlBtn.className = "iv-fs-action"; dlBtn.textContent = "\u2b07 Download"; dlBtn.title = "Download as file"; dlBtn.addEventListener("click", function(){ downloadText(content, path); });\n' +
      '    header.appendChild(title); header.appendChild(copyBtn); header.appendChild(dlBtn); header.appendChild(closeBtn);\n' +
      '    fs.appendChild(header); fs.appendChild(body);\n' +
      '    document.body.appendChild(fs);\n' +
      '  }\n' +
      '\n' +
      '  renderTree();\n' +
      '});\n' +
      '\n' +
      '})();\n' +
      '<\/script>\n' +
      '</body>\n' +
      '</html>';

    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(blueprintData.code || 'integration') + '_' + sanitizeFilename(blueprintData.version || 'export') + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Archive load / import ──────────────────────────────────────────── */

  function processArchiveBuffer(arrayBuffer) {
    var progressEl = document.getElementById('iv-progress-span');
    if (progressEl) progressEl.textContent = 'Parsing archive…';
    return parseArchive(arrayBuffer).then(function (parsed) {
      if (progressEl) progressEl.textContent = 'Parsing project.xml…';
      var bp = parseProjectXml(parsed.projectXml);
      if (progressEl) progressEl.textContent = 'Merging resources…';
      var count = mergeArchiveIntoBlueprint(bp, parsed.fileMap);

      blueprintData = bp;
      var meta = document.getElementById('iv-meta-text');
      if (meta) {
        var label = (bp.code || '') + ' | v' + (bp.version || '');
        if (bp.name) label = bp.name + '  ·  ' + label;
        meta.textContent = label;
      }
      renderTree();

      if (progressEl) progressEl.textContent = 'Loaded (' + count + ' activities enriched)';
      setTimeout(function () {
        if (progressEl && progressEl.textContent.indexOf('Loaded') === 0) {
          progressEl.textContent = '';
        }
      }, 4000);
    });
  }

  function loadArchiveFromServer() {
    if (!currentCode || !currentVersion) {
      showError('Enter integration code and version first.');
      return;
    }
    if (location.hostname.indexOf('oraclecloud.com') === -1) {
      showError('Import Live requires an OIC page (*.oraclecloud.com). Use Upload Archive to load a local .iar file instead.');
      return;
    }
    var progressEl = document.getElementById('iv-progress-span');
    var btn = document.getElementById('iv-archive-btn');
    if (btn) btn.disabled = true;
    if (progressEl) progressEl.textContent = 'Downloading archive…';

    fetchArchive(currentCode, currentVersion)
      .then(processArchiveBuffer)
      .catch(function (err) {
        showError('Archive load failed: ' + (err.message || String(err)));
      })
      .then(function () {
        if (btn) btn.disabled = false;
      });
  }

  function loadArchiveFromFile(arrayBuffer) {
    activeTypeFilters.clear();
    if (!overlay) createOverlay();
    var progressEl = document.getElementById('iv-progress-span');
    if (progressEl) progressEl.textContent = 'Parsing archive…';
    processArchiveBuffer(arrayBuffer).catch(function (err) {
      showError('Archive load failed: ' + (err.message || String(err)));
    });
  }

  /* ── Main flow ──────────────────────────────────────────────────────── */

  function openEmptyViewer() {
    loadSettings(function () {
      activeTypeFilters.clear();
      createOverlay();
      var tc = document.getElementById('iv-tree-container');
      if (tc) {
        tc.innerHTML = '<div class="iv-empty-state">Enter Integration Code &amp; Version, then click <b>Import Live</b>,<br>or click <b>Upload Archive</b> to load a .iar file.</div>';
      }
    });
  }

  function openViewerWithData(data) {
    loadSettings(function () {
      activeTypeFilters.clear();
      blueprintData = data;
      createOverlay();
      var meta = document.getElementById('iv-meta-text');
      if (meta) {
        var label = (data.code || '') + ' | v' + (data.version || '');
        if (data.name) label = data.name + '  ·  ' + label;
        meta.textContent = label || 'Imported data';
      }
      renderTree();
    });
  }

  /* ── Message listener ───────────────────────────────────────────────── */

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return false;

    if (msg.type === 'ping') {
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'iv-openEmptyViewer') {
      openEmptyViewer();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'iv-importData') {
      openViewerWithData(msg.data);
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'iv-themeChanged') {
      applyTheme(msg.theme);
      rerenderTree();
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  /* ═══════════════════════════════════════════════════════════════════
     COMPARE MODE — fully isolated from the main overlay.
     Reuses pure helpers (parseArchive, parseProjectXml, mergeArchiveIntoBlueprint,
     fetchArchive, getActivityName, getEffectiveType, getActivityXpath,
     truncateXpath, escapeHtml, sanitizeFilename, debounce, getBadgeColor,
     TYPE_DISPLAY, DEFAULT_COLORS, THEMES) but never calls into main-overlay
     stateful code. All DOM lives under #oic-iv-compare-overlay.
     ═══════════════════════════════════════════════════════════════════ */

  var cmpOverlay = null;
  var cmpLeft = null;        // { blueprint, label }
  var cmpRight = null;       // { blueprint, label }
  var cmpDiffRoot = null;    // the root DiffNode
  var cmpShowOnlyChanges = true;
  var cmpViewMode = 'tree'; // 'tree' | 'table'
  var cmpOnKeyDown = null;

  function openCompareOverlay(initialLeftBlueprint) {
    if (cmpOverlay) return;
    createCompareOverlay();
    if (initialLeftBlueprint) {
      cmpLeft = { blueprint: initialLeftBlueprint, label: describeBlueprint(initialLeftBlueprint) };
      updateCompareSideStatus('left');
      rebuildCompareDiff();
    }
  }

  function closeCompareOverlay() {
    if (!cmpOverlay) return;
    cmpOverlay.remove();
    cmpOverlay = null;
    cmpLeft = null;
    cmpRight = null;
    cmpDiffRoot = null;
    if (cmpOnKeyDown) {
      document.removeEventListener('keydown', cmpOnKeyDown);
      cmpOnKeyDown = null;
    }
  }

  function describeBlueprint(bp) {
    if (!bp) return '';
    var parts = [];
    if (bp.name) parts.push(bp.name);
    if (bp.code) parts.push(bp.code);
    if (bp.version) parts.push('v' + bp.version);
    return parts.join(' · ');
  }

  function createCompareOverlay() {
    cmpViewMode = 'tree';
    cmpOverlay = document.createElement('div');
    cmpOverlay.id = 'oic-iv-compare-overlay';
    cmpOverlay.setAttribute('data-theme', currentTheme);

    /* Header */
    var header = document.createElement('div');
    header.className = 'iv-cmp-header';

    var title = document.createElement('h2');
    title.textContent = 'Compare Integrations';

    var themeSel = document.createElement('select');
    themeSel.className = 'iv-cmp-theme-select';
    THEMES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      if (t.id === currentTheme) opt.selected = true;
      themeSel.appendChild(opt);
    });
    themeSel.addEventListener('change', function () {
      currentTheme = themeSel.value;
      cmpOverlay.setAttribute('data-theme', currentTheme);
      try { chrome.storage.local.set({ ivTheme: currentTheme }); } catch (e) { }
      renderCompareDiff();
    });

    var closeBtn = document.createElement('button');
    closeBtn.className = 'iv-cmp-close-btn';
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', closeCompareOverlay);

    header.appendChild(title);
    header.appendChild(themeSel);
    header.appendChild(closeBtn);

    /* Two source bars */
    var leftBar = buildCompareSourceBar('left');
    var rightBar = buildCompareSourceBar('right');

    /* Toolbar */
    var toolbar = document.createElement('div');
    toolbar.className = 'iv-cmp-toolbar';

    var searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.id = 'iv-cmp-search';
    searchInput.placeholder = 'Search…';
    searchInput.addEventListener('input', debounce(applyCompareFilters, 200));

    var matchCount = document.createElement('span');
    matchCount.id = 'iv-cmp-match-count';
    matchCount.className = 'iv-cmp-match-count';

    var onlyChangesLabel = document.createElement('label');
    onlyChangesLabel.className = 'iv-cmp-checkbox';
    var onlyChangesCb = document.createElement('input');
    onlyChangesCb.type = 'checkbox';
    onlyChangesCb.checked = cmpShowOnlyChanges;
    onlyChangesCb.addEventListener('change', function () {
      cmpShowOnlyChanges = onlyChangesCb.checked;
      applyCompareFilters();
    });
    onlyChangesLabel.appendChild(onlyChangesCb);
    onlyChangesLabel.appendChild(document.createTextNode(' Show only changes'));

    var expandBtn = document.createElement('button');
    expandBtn.textContent = '⊞ Expand All';
    expandBtn.addEventListener('click', function () { compareExpandCollapseAll(true); });

    var collapseBtn = document.createElement('button');
    collapseBtn.textContent = '⊟ Collapse All';
    collapseBtn.addEventListener('click', function () { compareExpandCollapseAll(false); });

    var exportHtmlBtn = document.createElement('button');
    exportHtmlBtn.textContent = '⬇ HTML';
    exportHtmlBtn.addEventListener('click', compareExportHtml);

    var exportJsonBtn = document.createElement('button');
    exportJsonBtn.textContent = '⬇ JSON';
    exportJsonBtn.addEventListener('click', compareExportJson);

    var progressSpan = document.createElement('span');
    progressSpan.className = 'iv-cmp-progress';
    progressSpan.id = 'iv-cmp-progress';

    var viewToggle = document.createElement('div');
    viewToggle.className = 'iv-cmp-view-toggle';
    var treeBtn = document.createElement('button');
    treeBtn.className = 'iv-cmp-view-btn iv-cmp-view-btn-active';
    treeBtn.dataset.view = 'tree';
    treeBtn.textContent = 'Tree';
    var tableBtn = document.createElement('button');
    tableBtn.className = 'iv-cmp-view-btn';
    tableBtn.dataset.view = 'table';
    tableBtn.textContent = 'Table';
    viewToggle.appendChild(treeBtn);
    viewToggle.appendChild(tableBtn);
    function setViewMode(mode) {
      if (mode === cmpViewMode) return;
      cmpViewMode = mode;
      treeBtn.classList.toggle('iv-cmp-view-btn-active', mode === 'tree');
      tableBtn.classList.toggle('iv-cmp-view-btn-active', mode === 'table');
      renderCompareDiff();
      applyCompareFilters();
    }
    treeBtn.addEventListener('click', function () { setViewMode('tree'); });
    tableBtn.addEventListener('click', function () { setViewMode('table'); });

    toolbar.appendChild(searchInput);
    toolbar.appendChild(matchCount);
    toolbar.appendChild(onlyChangesLabel);
    toolbar.appendChild(expandBtn);
    toolbar.appendChild(collapseBtn);
    toolbar.appendChild(exportHtmlBtn);
    toolbar.appendChild(exportJsonBtn);
    toolbar.appendChild(viewToggle);
    toolbar.appendChild(progressSpan);

    /* Tree container */
    var treeContainer = document.createElement('div');
    treeContainer.className = 'iv-cmp-tree-container';
    treeContainer.id = 'iv-cmp-tree-container';
    treeContainer.innerHTML = '<div class="iv-cmp-empty">Load integrations on both sides to see a diff.</div>';

    cmpOverlay.appendChild(header);
    cmpOverlay.appendChild(leftBar);
    cmpOverlay.appendChild(rightBar);
    cmpOverlay.appendChild(toolbar);
    cmpOverlay.appendChild(treeContainer);

    document.body.appendChild(cmpOverlay);

    cmpOnKeyDown = function (e) {
      if (e.key === 'Escape' && !document.getElementById('oic-iv-fullscreen')) {
        closeCompareOverlay();
      }
    };
    document.addEventListener('keydown', cmpOnKeyDown);
  }

  function buildCompareSourceBar(side) {
    var bar = document.createElement('div');
    bar.className = 'iv-cmp-source-bar iv-cmp-source-bar-' + side;

    var sideLabel = document.createElement('span');
    sideLabel.className = 'iv-cmp-side-badge';
    sideLabel.textContent = side === 'left' ? 'LEFT' : 'RIGHT';

    var status = document.createElement('span');
    status.className = 'iv-cmp-side-status';
    status.id = 'iv-cmp-' + side + '-status';
    status.textContent = '(not loaded)';

    var codeField = document.createElement('input');
    codeField.type = 'text';
    codeField.placeholder = 'Integration Code';
    codeField.className = 'iv-cmp-input';
    codeField.id = 'iv-cmp-' + side + '-code';

    var versionField = document.createElement('input');
    versionField.type = 'text';
    versionField.placeholder = 'Version';
    versionField.className = 'iv-cmp-input iv-cmp-input-sm';
    versionField.id = 'iv-cmp-' + side + '-version';

    var liveBtn = document.createElement('button');
    liveBtn.textContent = '📦 Live';
    liveBtn.title = 'Download archive from OIC server';
    liveBtn.addEventListener('click', function () {
      var c = codeField.value.trim();
      var v = versionField.value.trim();
      if (!c || !v) { setComparePI(side, 'Enter Code and Version'); return; }
      if (location.hostname.indexOf('oraclecloud.com') === -1) {
        setComparePI(side, 'Live requires *.oraclecloud.com page; use Upload Archive instead.');
        return;
      }
      setComparePI(side, 'Downloading…');
      liveBtn.disabled = true;
      fetchArchive(c, v)
        .then(function (ab) { return processCompareArchive(side, ab); })
        .catch(function (err) { setComparePI(side, 'Error: ' + (err.message || err)); })
        .then(function () { liveBtn.disabled = false; });
    });

    var uploadBtn = document.createElement('button');
    uploadBtn.textContent = '📂 Upload';
    uploadBtn.title = 'Upload a .iar archive';
    uploadBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.iar,.zip';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        setComparePI(side, 'Reading…');
        var r = new FileReader();
        r.onload = function () { processCompareArchive(side, r.result); };
        r.onerror = function () { setComparePI(side, 'Read failed'); };
        r.readAsArrayBuffer(f);
      });
      input.click();
    });

    var jsonBtn = document.createElement('button');
    jsonBtn.textContent = '📄 JSON';
    jsonBtn.title = 'Import a previously-exported JSON blueprint';
    jsonBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        if (!f) return;
        setComparePI(side, 'Reading…');
        var r = new FileReader();
        r.onload = function () {
          try {
            var data = JSON.parse(r.result);
            if (!data || !data.orchestration) throw new Error('Invalid blueprint JSON');
            if (side === 'left') cmpLeft = { blueprint: data, label: describeBlueprint(data) };
            else cmpRight = { blueprint: data, label: describeBlueprint(data) };
            updateCompareSideStatus(side);
            setComparePI(side, '');
            rebuildCompareDiff();
          } catch (e) {
            setComparePI(side, 'Parse failed: ' + e.message);
          }
        };
        r.readAsText(f);
      });
      input.click();
    });

    bar.appendChild(sideLabel);
    bar.appendChild(status);
    bar.appendChild(codeField);
    bar.appendChild(versionField);
    bar.appendChild(liveBtn);
    bar.appendChild(uploadBtn);
    bar.appendChild(jsonBtn);
    return bar;
  }

  function setComparePI(side, msg) {
    var el = document.getElementById('iv-cmp-progress');
    if (!el) return;
    el.textContent = msg ? ('[' + side + '] ' + msg) : '';
  }

  function updateCompareSideStatus(side) {
    var el = document.getElementById('iv-cmp-' + side + '-status');
    if (!el) return;
    var obj = side === 'left' ? cmpLeft : cmpRight;
    el.textContent = obj ? obj.label : '(not loaded)';
    el.classList.toggle('iv-cmp-loaded', !!obj);
  }

  function processCompareArchive(side, arrayBuffer) {
    setComparePI(side, 'Parsing archive…');
    return parseArchive(arrayBuffer).then(function (parsed) {
      setComparePI(side, 'Parsing project.xml…');
      var bp = parseProjectXml(parsed.projectXml);
      setComparePI(side, 'Merging resources…');
      mergeArchiveIntoBlueprint(bp, parsed.fileMap);
      if (side === 'left') cmpLeft = { blueprint: bp, label: describeBlueprint(bp) };
      else cmpRight = { blueprint: bp, label: describeBlueprint(bp) };
      updateCompareSideStatus(side);
      setComparePI(side, '');
      rebuildCompareDiff();
    });
  }

  function rebuildCompareDiff() {
    if (!cmpOverlay) return;
    if (!cmpLeft || !cmpRight) {
      var tc = document.getElementById('iv-cmp-tree-container');
      if (tc) {
        tc.innerHTML = '<div class="iv-cmp-empty">Load integrations on both sides to see a diff.</div>';
      }
      return;
    }
    cmpDiffRoot = buildDiffModel(cmpLeft.blueprint, cmpRight.blueprint);
    renderCompareDiff();
    applyCompareFilters();
  }

  function renderCompareDiff() {
    if (cmpViewMode === 'table') renderCompareDiffTable();
    else renderCompareDiffTree();
  }

  /* ── Matching ─────────────────────────────────────────────────────── */

  function cmpDisplayName(a) {
    if (!a) return '';
    return a.name || a.endpointName || a.variableName || a.faultName ||
      (a.mappedTarget && a.mappedTarget.name) || a.connectionName || '';
  }

  function cmpGetChildren(activity) {
    // Ordered child slots for sequence matching (no virtual wrappers).
    // Blueprint root: { name, code, version, orchestration: { globalTry, globalVariables } }
    if (activity && activity.orchestration && !activity.type) {
      var orch = activity.orchestration;
      var roots = [];
      if (orch.globalVariables && orch.globalVariables.length) {
        roots = roots.concat(orch.globalVariables);
      }
      if (orch.globalTry) roots.push(orch.globalTry);
      return { main: roots };
    }
    var t = activity.type || activity._virtualType || '';
    if (t === 'TRY' || t === 'GLOBAL_TRY') {
      return {
        main: (activity.activities || []).slice(),
        faults: (activity.catches || []).slice().concat(activity.catchAll ? [activity.catchAll] : [])
      };
    }
    if (t === 'FOR_EACH' || t === 'WHILE') {
      return { main: (activity.activities || []).slice() };
    }
    if (t === 'ROUTER') {
      return { routes: (activity.routes || activity.routerRoutes || []).slice() };
    }
    return { main: (activity.activities || []).slice() };
  }

  // Equivalence key: "same kind of activity at this position".
  function cmpSeqKey(a) {
    return (a.type || '') + '::' + cmpDisplayName(a);
  }

  // LCS diff of two arrays by a key function.
  // Returns an ordered list of { op: 'match'|'added'|'removed', left?, right? }.
  function cmpLcsDiff(leftArr, rightArr, keyFn) {
    var n = leftArr.length, m = rightArr.length;
    var lcs = new Array(n + 1);
    for (var i = 0; i <= n; i++) {
      lcs[i] = new Array(m + 1);
      lcs[i][0] = 0;
    }
    for (var j = 0; j <= m; j++) lcs[0][j] = 0;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        lcs[i][j] = (keyFn(leftArr[i - 1]) === keyFn(rightArr[j - 1]))
          ? lcs[i - 1][j - 1] + 1
          : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
    var out = [];
    i = n; j = m;
    while (i > 0 && j > 0) {
      if (keyFn(leftArr[i - 1]) === keyFn(rightArr[j - 1])) {
        out.unshift({ op: 'match', left: leftArr[i - 1], right: rightArr[j - 1] });
        i--; j--;
      } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
        out.unshift({ op: 'removed', left: leftArr[i - 1] });
        i--;
      } else {
        out.unshift({ op: 'added', right: rightArr[j - 1] });
        j--;
      }
    }
    while (i > 0) { out.unshift({ op: 'removed', left: leftArr[i - 1] }); i--; }
    while (j > 0) { out.unshift({ op: 'added', right: rightArr[j - 1] }); j--; }

    // Safety net: pair up unmatched elements of the same type sequentially.
    // This correctly aligns renames (where type is identical but display name differs)
    // without crossing over or mismatching based on reverse output order.
    var unmatchedLeft = [];
    var unmatchedRight = [];
    var result = [];
    
    function flushUnmatched() {
      var li = 0, ri = 0;
      while (li < unmatchedLeft.length || ri < unmatchedRight.length) {
        if (li < unmatchedLeft.length && ri < unmatchedRight.length && unmatchedLeft[li].type === unmatchedRight[ri].type) {
          result.push({ op: 'match', left: unmatchedLeft[li], right: unmatchedRight[ri] });
          li++; ri++;
        } else if (li < unmatchedLeft.length && ri < unmatchedRight.length) {
          result.push({ op: 'removed', left: unmatchedLeft[li] });
          li++;
        } else if (li < unmatchedLeft.length) {
          result.push({ op: 'removed', left: unmatchedLeft[li] });
          li++;
        } else {
          result.push({ op: 'added', right: unmatchedRight[ri] });
          ri++;
        }
      }
      unmatchedLeft.length = 0;
      unmatchedRight.length = 0;
    }

    for (var k = 0; k < out.length; k++) {
      if (out[k].op === 'match') {
        flushUnmatched();
        result.push(out[k]);
      } else if (out[k].op === 'removed') {
        unmatchedLeft.push(out[k].left);
      } else if (out[k].op === 'added') {
        unmatchedRight.push(out[k].right);
      }
    }
    flushUnmatched();
    out = result;
    return out;
  }

  /* ── Diff model ───────────────────────────────────────────────────── */

  var DIFF_FIELDS = [
    'type', 'name', 'code', 'version', 'pattern', 'smartTags',
    'displayName', 'description', 'faultName',
    'variableName', 'variableDescription',
    'connectionName', 'connectionTypeName', 'adapterType',
    'endpointName', 'endpointMEP', 'binding'
  ];

  // Position-based sequence diff. At each level: LCS by (type+name), matched pairs descend
  // recursively; everything else is added or removed. A post-LCS safety net promotes
  // adjacent remove+add of the same type to a match (covers in-place renames).
  // No cross-level "moved" detection — the flow is treated as an ordered document.
  function buildDiffModel(leftRoot, rightRoot) {

    function buildMatched(leftAct, rightAct) {
      var fieldDiffs = computeFieldDiffs(leftAct, rightAct);
      var fileDiffs = computeFileDiffs(leftAct, rightAct);
      var children = buildChildren(leftAct, rightAct);

      var hasSelfChanges = fieldDiffs.length > 0 ||
        fileDiffs.some(function (f) { return f.status !== 'unchanged'; });
      var hasChildChanges = children.some(function (c) { return c.status !== 'unchanged'; });
      var status = (hasSelfChanges || hasChildChanges) ? 'modified' : 'unchanged';

      return {
        status: status,
        left: leftAct, right: rightAct,
        fieldDiffs: fieldDiffs,
        fileDiffs: fileDiffs,
        children: children
      };
    }

    function buildOneSided(act, status) {
      return {
        status: status,
        left: status === 'removed' ? act : null,
        right: status === 'added' ? act : null,
        fieldDiffs: [],
        fileDiffs: [],
        children: childrenFromOneSide(act, status)
      };
    }

    function buildChildren(la, ra) {
      var lc = cmpGetChildren(la);
      var rc = cmpGetChildren(ra);
      var slots = [];
      var seen = {};
      Object.keys(lc).forEach(function (s) { if (!seen[s]) { seen[s] = 1; slots.push(s); } });
      Object.keys(rc).forEach(function (s) { if (!seen[s]) { seen[s] = 1; slots.push(s); } });

      var out = [];
      slots.forEach(function (slot) {
        var leftSeq = lc[slot] || [];
        var rightSeq = rc[slot] || [];
        var steps = cmpLcsDiff(leftSeq, rightSeq, cmpSeqKey);
        steps.forEach(function (step) {
          if (step.op === 'match') out.push(buildMatched(step.left, step.right));
          else if (step.op === 'added') out.push(buildOneSided(step.right, 'added'));
          else out.push(buildOneSided(step.left, 'removed'));
        });
      });
      return out;
    }

    function childrenFromOneSide(act, status) {
      var c = cmpGetChildren(act);
      var out = [];
      Object.keys(c).forEach(function (slot) {
        (c[slot] || []).forEach(function (ch) { out.push(buildOneSided(ch, status)); });
      });
      return out;
    }

    if (!leftRoot && !rightRoot) return null;
    if (!leftRoot) return buildOneSided(rightRoot, 'added');
    if (!rightRoot) return buildOneSided(leftRoot, 'removed');
    return buildMatched(leftRoot, rightRoot);
  }

  function computeFieldDiffs(left, right) {
    var diffs = [];
    DIFF_FIELDS.forEach(function (k) {
      var lv = left[k];
      var rv = right[k];
      if ((lv == null || lv === '') && (rv == null || rv === '')) return;
      if (lv !== rv) diffs.push({ key: k, oldValue: lv, newValue: rv });
    });
    // mappedTarget.name
    var lmt = left.mappedTarget && left.mappedTarget.name;
    var rmt = right.mappedTarget && right.mappedTarget.name;
    if ((lmt || rmt) && lmt !== rmt) diffs.push({ key: 'mappedTarget.name', oldValue: lmt, newValue: rmt });

    // _archiveDetail.expression fields
    var le = left._archiveDetail && left._archiveDetail.expression;
    var re = right._archiveDetail && right._archiveDetail.expression;
    if (le || re) {
      var exprKeys = ['VariableName', 'VariableType', 'VariableDescription', 'TextExpression', 'XpathExpression', 'NamespaceList'];
      exprKeys.forEach(function (k) {
        var lv = (le && le[k]);
        var rv = (re && re[k]);
        if ((lv == null || lv === '') && (rv == null || rv === '')) return;
        if (lv !== rv) diffs.push({ key: 'expression.' + k, oldValue: lv, newValue: rv });
      });
    }
    return diffs;
  }

  function computeFileDiffs(left, right) {
    var lf = (left._archiveDetail && left._archiveDetail.files) || {};
    var rf = (right._archiveDetail && right._archiveDetail.files) || {};
    var keys = {};
    Object.keys(lf).forEach(function (k) { keys[k] = true; });
    Object.keys(rf).forEach(function (k) { keys[k] = true; });
    var out = [];
    Object.keys(keys).sort().forEach(function (p) {
      var l = lf[p];
      var r = rf[p];
      if (l == null && r != null) out.push({ path: p, status: 'added', leftContent: null, rightContent: r });
      else if (r == null && l != null) out.push({ path: p, status: 'removed', leftContent: l, rightContent: null });
      else if (l === r) out.push({ path: p, status: 'unchanged', leftContent: l, rightContent: r });
      else out.push({ path: p, status: 'modified', leftContent: l, rightContent: r, lines: computeLineDiff(l || '', r || '') });
    });
    return out;
  }

  // Simple LCS-based line diff → array of { op: ' '|'+'|'-', text }
  function computeLineDiff(aText, bText) {
    var a = aText.split('\n');
    var b = bText.split('\n');
    var n = a.length, m = b.length;
    // Build LCS table
    var lcs = new Array(n + 1);
    for (var i = 0; i <= n; i++) {
      lcs[i] = new Array(m + 1);
      lcs[i][0] = 0;
    }
    for (var j = 0; j <= m; j++) lcs[0][j] = 0;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        lcs[i][j] = (a[i - 1] === b[j - 1]) ? lcs[i - 1][j - 1] + 1 : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
    // Back-trace
    var out = [];
    i = n; j = m;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) { out.unshift({ op: ' ', text: a[i - 1] }); i--; j--; }
      else if (lcs[i - 1][j] >= lcs[i][j - 1]) { out.unshift({ op: '-', text: a[i - 1] }); i--; }
      else { out.unshift({ op: '+', text: b[j - 1] }); j--; }
    }
    while (i > 0) { out.unshift({ op: '-', text: a[--i] }); }
    while (j > 0) { out.unshift({ op: '+', text: b[--j] }); }
    return out;
  }

  /* ── Rendering ────────────────────────────────────────────────────── */

  function renderCompareDiffTable() {
    var tc = document.getElementById('iv-cmp-tree-container');
    if (!tc) return;
    tc.innerHTML = '';
    if (!cmpDiffRoot) {
      tc.innerHTML = '<div class="iv-cmp-empty">Load both sides to see a diff.</div>';
      return;
    }
    var table = document.createElement('div');
    table.className = 'iv-cmp-table';

    var head = document.createElement('div');
    head.className = 'iv-cmp-table-head';
    var hSpacer = document.createElement('div');
    var hLeft = document.createElement('div');
    hLeft.className = 'iv-cmp-table-head-left';
    hLeft.textContent = (cmpLeft && cmpLeft.label) || 'LEFT';
    var hRight = document.createElement('div');
    hRight.className = 'iv-cmp-table-head-right';
    hRight.textContent = (cmpRight && cmpRight.label) || 'RIGHT';
    head.appendChild(hSpacer);
    head.appendChild(hLeft);
    head.appendChild(hRight);
    table.appendChild(head);

    (cmpDiffRoot.children || []).forEach(function (c) {
      table.appendChild(renderDiffRow(c, 0));
    });
    tc.appendChild(table);
  }

  function renderDiffRow(dn, depth) {
    var row = document.createElement('div');
    row.className = 'iv-cmp-node iv-cmp-trow iv-cmp-trow-' + dn.status + ' iv-cmp-status-' + dn.status;
    row._diff = dn;

    var hasChildren = dn.children && dn.children.length > 0;
    var hasFieldDiffs = dn.fieldDiffs && dn.fieldDiffs.length > 0;
    var hasFileDiffs = dn.fileDiffs && dn.fileDiffs.some(function (f) { return f.status !== 'unchanged'; });
    var oneSidedHasArchive =
      (dn.status === 'added' && dn.right && dn.right._archiveDetail) ||
      (dn.status === 'removed' && dn.left && dn.left._archiveDetail);
    var canExpand = hasChildren || hasFieldDiffs || hasFileDiffs ||
      (dn.status !== 'unchanged' && (hasFieldDiffs || hasFileDiffs)) || oneSidedHasArchive;

    var header = document.createElement('div');
    header.className = 'iv-cmp-trow-header';

    var toggle = document.createElement('span');
    toggle.className = 'iv-cmp-toggle' + (canExpand ? '' : ' iv-cmp-leaf');
    toggle.textContent = canExpand ? '▶' : '·';

    var leftCell = buildTableCell(dn, 'left');
    var rightCell = buildTableCell(dn, 'right');

    header.appendChild(toggle);
    header.appendChild(leftCell);
    header.appendChild(rightCell);
    row.appendChild(header);

    if (!canExpand) return row;

    var expand = document.createElement('div');
    expand.className = 'iv-cmp-trow-expand';

    var detailBuilt = false;
    var includeDetail = hasFieldDiffs || hasFileDiffs ||
      (dn.status !== 'unchanged' && dn.status !== 'added' && dn.status !== 'removed') ||
      oneSidedHasArchive;
    if (includeDetail) {
      var body = renderDiffDetail(dn);
      if (body) {
        body.classList.add('iv-cmp-open');
        expand.appendChild(body);
        detailBuilt = true;
      }
    }

    if (hasChildren) {
      var nested = document.createElement('div');
      nested.className = 'iv-cmp-table iv-cmp-nested iv-cmp-children';
      dn.children.forEach(function (c) {
        nested.appendChild(renderDiffRow(c, depth + 1));
      });
      expand.appendChild(nested);
    }

    if (!detailBuilt && !hasChildren) {
      // Nothing to show — drop expand
      return row;
    }

    row.appendChild(expand);

    function toggleOpen() {
      row.classList.toggle('iv-cmp-trow-open');
      var isOpen = row.classList.contains('iv-cmp-trow-open');
      toggle.textContent = isOpen ? '▼' : '▶';
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleOpen();
    });
    header.addEventListener('click', function () {
      toggleOpen();
    });

    return row;
  }

  function buildTableCell(dn, side) {
    var cell = document.createElement('div');
    cell.className = 'iv-cmp-tcell iv-cmp-tcell-' + side;
    var act = side === 'left' ? dn.left : dn.right;
    if (!act) {
      cell.classList.add('iv-cmp-tcell-empty');
      cell.textContent = '—';
      return cell;
    }
    var typeBadge = document.createElement('span');
    typeBadge.className = 'iv-cmp-type-badge';
    var effType = diffNodeEffectiveType(dn);
    typeBadge.textContent = diffNodeDisplayType(dn);
    typeBadge.style.background = getBadgeColor(effType);
    cell.appendChild(typeBadge);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'iv-cmp-node-name';
    nameSpan.textContent = getActivityName(act) || '';
    cell.appendChild(nameSpan);

    if (act.adapterType) {
      var connBadge = document.createElement('span');
      connBadge.className = 'iv-cmp-conn-badge';
      connBadge.textContent = act.adapterType;
      cell.appendChild(connBadge);
    }
    return cell;
  }

  function renderCompareDiffTree() {
    var tc = document.getElementById('iv-cmp-tree-container');
    if (!tc) return;
    tc.innerHTML = '';
    if (!cmpDiffRoot) {
      tc.innerHTML = '<div class="iv-cmp-empty">Load both sides to see a diff.</div>';
      return;
    }
    tc.appendChild(renderDiffNode(cmpDiffRoot, 0));
  }

  function diffNodeEffectiveType(dn) {
    var a = dn.right || dn.left;
    if (!a) return '';
    // Main overlay's LABEL→ASSIGN coalescing — recompute locally
    if (a.type === 'LABEL' && a.activities && a.activities.length > 0 &&
        a.activities.every(function (x) { return x.type === 'ASSIGNMENT'; })) {
      return 'ASSIGNMENT';
    }
    return a.type || '';
  }

  function diffNodeDisplayType(dn) {
    var t = diffNodeEffectiveType(dn);
    return TYPE_DISPLAY[t] || t || '';
  }

  function renderDiffNode(dn, depth) {
    var node = document.createElement('div');
    node.className = 'iv-cmp-node iv-cmp-status-' + dn.status;
    node._diff = dn;

    var hasChildren = dn.children && dn.children.length > 0;
    var header = document.createElement('div');
    header.className = 'iv-cmp-node-header';

    var toggle = document.createElement('span');
    toggle.className = 'iv-cmp-toggle' + (hasChildren ? '' : ' iv-cmp-leaf');
    toggle.textContent = hasChildren ? '▶' : '·';

    var statusBadge = document.createElement('span');
    statusBadge.className = 'iv-cmp-status-badge iv-cmp-status-badge-' + dn.status;
    statusBadge.textContent = ({ added: '+', removed: '−', modified: '~', moved: '→', unchanged: '=' })[dn.status];

    var typeBadge = document.createElement('span');
    typeBadge.className = 'iv-cmp-type-badge';
    var effType = diffNodeEffectiveType(dn);
    var displayType = diffNodeDisplayType(dn);
    typeBadge.textContent = displayType;
    typeBadge.style.background = getBadgeColor(effType);

    var primary = dn.right || dn.left;
    var nameSpan = document.createElement('span');
    nameSpan.className = 'iv-cmp-node-name';
    nameSpan.textContent = primary ? getActivityName(primary) : '';

    // Inline preview (ASSIGN/ROUTE/THROW xpath). If both sides differ, show old → new.
    var detailText = '';
    if (primary) {
      var lxp = dn.left ? getActivityXpath(dn.left) : '';
      var rxp = dn.right ? getActivityXpath(dn.right) : '';
      if (primary.type === 'ASSIGNMENT') {
        if (dn.status === 'modified' && lxp && rxp && lxp !== rxp) {
          detailText = '= ' + truncateXpath(lxp) + '  →  ' + truncateXpath(rxp);
        } else if (rxp || lxp) detailText = '= ' + truncateXpath(rxp || lxp);
      } else if (primary.type === 'ROUTER_ROUTE') {
        if (dn.status === 'modified' && lxp !== rxp) {
          detailText = 'IF ' + (lxp ? truncateXpath(lxp) : 'OTHERWISE') + '  →  ' + (rxp ? truncateXpath(rxp) : 'OTHERWISE');
        } else {
          var xp = rxp || lxp;
          detailText = xp ? 'IF ' + truncateXpath(xp) : 'OTHERWISE';
        }
      } else if (primary.type === 'FOR_EACH' || primary.type === 'WHILE') {
        if (dn.status === 'modified' && lxp && rxp && lxp !== rxp) {
          detailText = truncateXpath(lxp) + '  →  ' + truncateXpath(rxp);
        } else if (rxp || lxp) detailText = truncateXpath(rxp || lxp);
      } else if (primary.type === 'THROW') {
        var x = rxp || lxp;
        if (x) detailText = 'IF NOT ' + truncateXpath(x);
      } else if (primary.type === 'INVOKE' || primary.type === 'RECEIVE' || primary.type === 'REPLY') {
        if (primary.endpointName && primary.endpointName !== getActivityName(primary)) detailText = primary.endpointName;
      }
    }

    var detailSpan = document.createElement('span');
    detailSpan.className = 'iv-cmp-node-detail';
    detailSpan.textContent = detailText;

    // Badge for adapter type
    var connBadge = null;
    if (primary && primary.adapterType) {
      connBadge = document.createElement('span');
      connBadge.className = 'iv-cmp-conn-badge';
      connBadge.textContent = primary.adapterType;
    }

    // Counter of changes for modified parents
    var changeCount = null;
    if (dn.status === 'modified' || dn.status === 'added' || dn.status === 'removed' || dn.status === 'moved') {
      var n = dn.fieldDiffs.length + dn.fileDiffs.filter(function (f) { return f.status !== 'unchanged'; }).length;
      if (n > 0) {
        changeCount = document.createElement('span');
        changeCount.className = 'iv-cmp-change-count';
        changeCount.textContent = '(' + n + ' change' + (n > 1 ? 's' : '') + ')';
      }
    }

    header.appendChild(toggle);
    header.appendChild(statusBadge);
    header.appendChild(typeBadge);
    header.appendChild(nameSpan);
    if (detailText) header.appendChild(detailSpan);
    if (connBadge) header.appendChild(connBadge);
    if (changeCount) header.appendChild(changeCount);

    node.appendChild(header);

    // Detail body (field diffs + file diffs)
    var body = null;
    if ((dn.status !== 'unchanged' && dn.status !== 'added' && dn.status !== 'removed') ||
        (dn.status === 'added' && (dn.right && dn.right._archiveDetail)) ||
        (dn.status === 'removed' && (dn.left && dn.left._archiveDetail))) {
      body = renderDiffDetail(dn);
      if (body) {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function (e) {
          if (e.target === toggle) return;
          body.classList.toggle('iv-cmp-open');
          header.classList.toggle('iv-cmp-header-active');
        });
        node.appendChild(body);
      }
    }

    // Children
    if (hasChildren) {
      var childrenDiv = document.createElement('div');
      childrenDiv.className = 'iv-cmp-children';
      childrenDiv.style.display = 'none';
      dn.children.forEach(function (c) {
        childrenDiv.appendChild(renderDiffNode(c, depth + 1));
      });
      node.appendChild(childrenDiv);

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = childrenDiv.style.display !== 'none';
        childrenDiv.style.display = open ? 'none' : 'block';
        toggle.textContent = open ? '▶' : '▼';
      });
    }

    return node;
  }

  function renderDiffDetail(dn) {
    var body = document.createElement('div');
    body.className = 'iv-cmp-node-body';

    if (dn.moved && dn.oldPath != null && dn.newPath != null) {
      var mv = document.createElement('div');
      mv.className = 'iv-cmp-moved-line';
      mv.innerHTML = '<span class="iv-cmp-detail-label">Moved:</span> ' +
        '<span class="iv-cmp-moved-from">' + escapeHtml(dn.oldPath || '(root)') + '</span>' +
        '  →  <span class="iv-cmp-moved-to">' + escapeHtml(dn.newPath || '(root)') + '</span>';
      body.appendChild(mv);
    }

    // Field diffs
    if (dn.fieldDiffs && dn.fieldDiffs.length > 0) {
      var fsHeader = document.createElement('div');
      fsHeader.className = 'iv-cmp-section-header';
      fsHeader.textContent = 'Field changes';
      body.appendChild(fsHeader);
      dn.fieldDiffs.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'iv-cmp-field-diff';
        row.innerHTML = '<span class="iv-cmp-detail-label">' + escapeHtml(f.key) + '</span>' +
          '<span class="iv-cmp-old">' + escapeHtml(f.oldValue == null ? '(none)' : String(f.oldValue)) + '</span>' +
          '  →  <span class="iv-cmp-new">' + escapeHtml(f.newValue == null ? '(none)' : String(f.newValue)) + '</span>';
        body.appendChild(row);
      });
    }

    // Added-only or removed-only: show all visible fields
    if ((dn.status === 'added' || dn.status === 'removed') && !dn.fieldDiffs.length) {
      var act = dn.status === 'added' ? dn.right : dn.left;
      if (act) {
        var hdr = document.createElement('div');
        hdr.className = 'iv-cmp-section-header';
        hdr.textContent = dn.status === 'added' ? 'Added activity' : 'Removed activity';
        body.appendChild(hdr);
        DIFF_FIELDS.forEach(function (k) {
          if (act[k]) {
            var r = document.createElement('div');
            r.className = 'iv-cmp-field-diff';
            r.innerHTML = '<span class="iv-cmp-detail-label">' + escapeHtml(k) + '</span>' +
              '<span class="iv-cmp-value">' + escapeHtml(String(act[k])) + '</span>';
            body.appendChild(r);
          }
        });
      }
    }

    // File diffs
    var changedFiles = (dn.fileDiffs || []).filter(function (f) { return f.status !== 'unchanged'; });
    if (changedFiles.length > 0) {
      var fh = document.createElement('div');
      fh.className = 'iv-cmp-section-header';
      fh.textContent = 'File changes';
      body.appendChild(fh);
      changedFiles.forEach(function (f) {
        var fRow = document.createElement('div');
        fRow.className = 'iv-cmp-file-row';
        var badge = document.createElement('span');
        badge.className = 'iv-cmp-file-badge iv-cmp-file-' + f.status;
        badge.textContent = ({ added: 'ADDED', removed: 'REMOVED', modified: 'MODIFIED' })[f.status];
        var pathSpan = document.createElement('span');
        pathSpan.className = 'iv-cmp-file-path';
        pathSpan.textContent = f.path;
        var copyBtn = document.createElement('button');
        copyBtn.className = 'iv-cmp-fullscreen-btn';
        copyBtn.textContent = '📋';
        copyBtn.title = 'Copy to clipboard' + (f.status === 'modified' ? ' (right side)' : '');
        copyBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var text = f.rightContent != null ? f.rightContent : f.leftContent || '';
          copyToClipboard(text, copyBtn);
        });

        var dlBtn = document.createElement('button');
        dlBtn.className = 'iv-cmp-fullscreen-btn';
        dlBtn.textContent = '⬇';
        dlBtn.title = 'Download file' + (f.status === 'modified' ? ' (right side)' : '');
        dlBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          var text = f.rightContent != null ? f.rightContent : f.leftContent || '';
          downloadText(text, f.path);
        });

        var fsBtn = document.createElement('button');
        fsBtn.className = 'iv-cmp-fullscreen-btn';
        fsBtn.textContent = '⛶';
        fsBtn.title = 'Open fullscreen';
        fsBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openCompareFullscreen(f);
        });
        fRow.appendChild(badge);
        fRow.appendChild(pathSpan);
        fRow.appendChild(copyBtn);
        fRow.appendChild(dlBtn);
        fRow.appendChild(fsBtn);
        body.appendChild(fRow);

        if (f.status === 'modified' && f.lines) {
          body.appendChild(renderLineDiff(f.lines));
        } else if (f.status === 'added' && f.rightContent) {
          var pre = document.createElement('pre');
          pre.className = 'iv-cmp-archive-file iv-cmp-pre-added';
          pre.textContent = f.rightContent;
          body.appendChild(pre);
        } else if (f.status === 'removed' && f.leftContent) {
          var pre2 = document.createElement('pre');
          pre2.className = 'iv-cmp-archive-file iv-cmp-pre-removed';
          pre2.textContent = f.leftContent;
          body.appendChild(pre2);
        }
      });
    }

    return body.childNodes.length > 0 ? body : null;
  }

  function renderLineDiff(lines) {
    var pre = document.createElement('pre');
    pre.className = 'iv-cmp-line-diff';
    var html = '';
    lines.forEach(function (l) {
      var cls = l.op === '+' ? 'iv-cmp-line-add' : l.op === '-' ? 'iv-cmp-line-del' : 'iv-cmp-line-ctx';
      html += '<span class="' + cls + '"><span class="iv-cmp-line-op">' + l.op + '</span>' + escapeHtml(l.text) + '</span>\n';
    });
    pre.innerHTML = html;
    return pre;
  }

  function openCompareFullscreen(fileDiff) {
    var existing = document.getElementById('oic-iv-fullscreen');
    if (existing) existing.remove();

    var fs = document.createElement('div');
    fs.id = 'oic-iv-fullscreen';
    fs.setAttribute('data-theme', currentTheme);

    var header = document.createElement('div');
    header.className = 'iv-fs-header';
    var title = document.createElement('span');
    title.className = 'iv-fs-title';
    title.textContent = fileDiff.path + '  (' + fileDiff.status + ')';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'iv-fs-close';
    closeBtn.textContent = '✕ Close';
    var fsEsc = function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeFs(); } };
    function closeFs() { document.removeEventListener('keydown', fsEsc); fs.remove(); }
    closeBtn.addEventListener('click', closeFs);
    document.addEventListener('keydown', fsEsc);

    header.appendChild(title);

    function addActionButton(label, titleText, handler) {
      var b = document.createElement('button');
      b.className = 'iv-fs-action';
      b.textContent = label;
      b.title = titleText;
      b.addEventListener('click', handler);
      header.appendChild(b);
    }
    if (fileDiff.status === 'modified') {
      addActionButton('📋 L', 'Copy left content', function () { copyToClipboard(fileDiff.leftContent || '', this); });
      addActionButton('📋 R', 'Copy right content', function () { copyToClipboard(fileDiff.rightContent || '', this); });
      addActionButton('⬇ L', 'Download left', function () { downloadText(fileDiff.leftContent || '', fileDiff.path + '.left'); });
      addActionButton('⬇ R', 'Download right', function () { downloadText(fileDiff.rightContent || '', fileDiff.path + '.right'); });
    } else {
      var fsContent = fileDiff.rightContent != null ? fileDiff.rightContent : (fileDiff.leftContent || '');
      addActionButton('📋 Copy', 'Copy to clipboard', function () { copyToClipboard(fsContent, this); });
      addActionButton('⬇ Download', 'Download as file', function () { downloadText(fsContent, fileDiff.path); });
    }

    header.appendChild(closeBtn);
    fs.appendChild(header);

    if (fileDiff.status === 'modified') {
      // Side-by-side split
      var split = document.createElement('div');
      split.className = 'iv-fs-split';
      var leftPre = document.createElement('pre');
      leftPre.className = 'iv-fs-body iv-cmp-split-pane iv-cmp-split-left';
      leftPre.textContent = fileDiff.leftContent || '';
      var rightPre = document.createElement('pre');
      rightPre.className = 'iv-fs-body iv-cmp-split-pane iv-cmp-split-right';
      rightPre.textContent = fileDiff.rightContent || '';
      split.appendChild(leftPre);
      split.appendChild(rightPre);
      fs.appendChild(split);
    } else {
      var pre = document.createElement('pre');
      pre.className = 'iv-fs-body';
      pre.textContent = fileDiff.rightContent || fileDiff.leftContent || '';
      fs.appendChild(pre);
    }

    document.body.appendChild(fs);
  }

  /* ── Search & filter ─────────────────────────────────────────────── */

  function getDiffSearchText(dn) {
    var parts = [];
    function addActivityText(a) {
      if (!a) return;
      DIFF_FIELDS.forEach(function (k) { if (a[k]) parts.push(String(a[k])); });
      if (a.mappedTarget && a.mappedTarget.name) parts.push(a.mappedTarget.name);
      if (a._archiveDetail) {
        var ad = a._archiveDetail;
        if (ad.expression) Object.keys(ad.expression).forEach(function (k) { parts.push(String(ad.expression[k] || '')); });
        if (ad.files) Object.keys(ad.files).forEach(function (k) { parts.push(k); parts.push(ad.files[k] || ''); });
      }
    }
    addActivityText(dn.left);
    addActivityText(dn.right);
    if (dn.oldPath) parts.push(dn.oldPath);
    if (dn.newPath) parts.push(dn.newPath);
    return parts.join(' ').toLowerCase();
  }

  function applyCompareFilters() {
    var input = document.getElementById('iv-cmp-search');
    var q = (input && input.value || '').toLowerCase().trim();
    var matchCountEl = document.getElementById('iv-cmp-match-count');
    var count = 0;
    var tc = document.getElementById('iv-cmp-tree-container');
    if (!tc) return;

    function visit(nodeEl) {
      var dn = nodeEl._diff;
      if (!dn) return false;
      var selfPass = true;
      var txt = getDiffSearchText(dn);
      if (q && txt.indexOf(q) === -1) selfPass = false;
      if (cmpShowOnlyChanges && dn.status === 'unchanged') selfPass = false;

      var childContainer = nodeEl.querySelector(
        ':scope > .iv-cmp-children, :scope > .iv-cmp-trow-expand > .iv-cmp-children'
      );
      var anyChildVisible = false;
      if (childContainer) {
        for (var i = 0; i < childContainer.children.length; i++) {
          var child = childContainer.children[i];
          if (child.classList && child.classList.contains('iv-cmp-node')) {
            if (visit(child)) anyChildVisible = true;
          }
        }
      }
      var visible = selfPass || anyChildVisible;
      nodeEl.classList.toggle('iv-cmp-hidden', !visible);
      if (selfPass) count++;
      return visible;
    }

    // Top-level rows live directly under `tc` in tree mode, or under `tc > .iv-cmp-table` in table mode.
    var topContainer = tc.querySelector(':scope > .iv-cmp-table') || tc;
    for (var i = 0; i < topContainer.children.length; i++) {
      var c = topContainer.children[i];
      if (c.classList && c.classList.contains('iv-cmp-node')) visit(c);
    }
    if (matchCountEl) matchCountEl.textContent = q ? (count + ' matches') : '';
  }

  function compareExpandCollapseAll(expand) {
    if (!cmpOverlay) return;
    cmpOverlay.querySelectorAll('.iv-cmp-children').forEach(function (el) {
      // Nested tables in table mode rely on the .iv-cmp-trow-open ancestor for visibility,
      // so don't override their display style.
      if (el.classList.contains('iv-cmp-table')) return;
      el.style.display = expand ? 'block' : 'none';
    });
    cmpOverlay.querySelectorAll('.iv-cmp-trow').forEach(function (el) {
      el.classList.toggle('iv-cmp-trow-open', !!expand);
    });
    cmpOverlay.querySelectorAll('.iv-cmp-toggle').forEach(function (el) {
      if (!el.classList.contains('iv-cmp-leaf')) el.textContent = expand ? '▼' : '▶';
    });
  }

  /* ── Export ────────────────────────────────────────────────────── */

  function compareExportJson() {
    if (!cmpLeft || !cmpRight) return;
    var payload = { left: cmpLeft.blueprint, right: cmpRight.blueprint, diff: serializeDiff(cmpDiffRoot) };
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'compare_' +
      sanitizeFilename(cmpLeft.blueprint.code || 'left') + '_' + sanitizeFilename(cmpLeft.blueprint.version || '') +
      '_vs_' +
      sanitizeFilename(cmpRight.blueprint.code || 'right') + '_' + sanitizeFilename(cmpRight.blueprint.version || '') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Serialize diff model without the activity references (replace with id/type/name for JSON)
  function serializeDiff(dn) {
    if (!dn) return null;
    function act(a) {
      if (!a) return null;
      return {
        type: a.type, id: a.id, name: a.name, refUri: a.refUri,
        variableName: a.variableName, faultName: a.faultName,
        connectionName: a.connectionName, endpointName: a.endpointName
      };
    }
    return {
      status: dn.status,
      oldPath: dn.oldPath || null,
      newPath: dn.newPath || null,
      left: act(dn.left),
      right: act(dn.right),
      fieldDiffs: dn.fieldDiffs || [],
      fileDiffs: (dn.fileDiffs || []).map(function (f) {
        return { path: f.path, status: f.status };
      }),
      children: (dn.children || []).map(serializeDiff)
    };
  }

  function compareExportHtml() {
    if (!cmpLeft || !cmpRight || !cmpDiffRoot) return;
    var cssUrl = chrome.runtime.getURL('content.css');
    fetch(cssUrl).then(function (r) { return r.text(); }).catch(function () { return ''; })
      .then(function (css) { buildCompareExportHtml(css); });
  }

  function buildCompareExportHtml(cssText) {
    var diffJson = JSON.stringify(cmpDiffRoot);
    var leftJson = JSON.stringify(cmpLeft.blueprint);
    var rightJson = JSON.stringify(cmpRight.blueprint);
    var title = 'Compare: ' + (cmpLeft.label || '') + ' vs ' + (cmpRight.label || '');
    var themeDefaultsJson = JSON.stringify(DEFAULT_COLORS);
    var typeDisplayJson = JSON.stringify(TYPE_DISPLAY);

    var html = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>\n' +
      '<style>\nbody { margin:0; padding:0; }\n' + cssText + '\n' +
      '#oic-iv-compare-overlay { position: relative !important; min-height: 100vh; }\n' +
      '</style></head><body>\n' +
      '<div id="oic-iv-compare-overlay" data-theme="' + escapeHtml(currentTheme) + '">\n' +
      '  <div class="iv-cmp-header"><h2>' + escapeHtml(title) + '</h2></div>\n' +
      '  <div class="iv-cmp-toolbar">\n' +
      '    <input type="search" id="iv-cmp-search" placeholder="Search…">\n' +
      '    <span id="iv-cmp-match-count" class="iv-cmp-match-count"></span>\n' +
      '    <label class="iv-cmp-checkbox"><input type="checkbox" id="iv-cmp-only-changes" checked> Show only changes</label>\n' +
      '    <button id="iv-cmp-expand">⊞ Expand All</button>\n' +
      '    <button id="iv-cmp-collapse">⊟ Collapse All</button>\n' +
      '  </div>\n' +
      '  <div class="iv-cmp-tree-container" id="iv-cmp-tree-container"></div>\n' +
      '</div>\n' +
      '<script>\n' +
      '(function(){\n' +
      '  var diff = ' + diffJson + ';\n' +
      '  var leftBp = ' + leftJson + ';\n' +
      '  var rightBp = ' + rightJson + ';\n' +
      '  var DEFAULT_COLORS = ' + themeDefaultsJson + ';\n' +
      '  var TYPE_DISPLAY = ' + typeDisplayJson + ';\n' +
      '  var currentTheme = document.getElementById("oic-iv-compare-overlay").getAttribute("data-theme") || "light";\n' +
      '  var DIFF_FIELDS = ' + JSON.stringify(DIFF_FIELDS) + ';\n' +
      '  var showOnlyChanges = true;\n' +
      '  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML;}\n' +
      '  function badgeColor(t){var th=DEFAULT_COLORS[currentTheme]||DEFAULT_COLORS.light;return th[t]||"#6b7280";}\n' +
      '  function effType(dn){var a=dn.right||dn.left;if(!a)return "";if(a.type==="LABEL"&&a.activities&&a.activities.length>0&&a.activities.every(function(x){return x.type==="ASSIGNMENT";}))return "ASSIGNMENT";return a.type||"";}\n' +
      '  function dispType(dn){var t=effType(dn);return TYPE_DISPLAY[t]||t||"";}\n' +
      '  function activityName(a){if(!a)return "";return a.name||a.endpointName||a.variableName||a.faultName||(a.mappedTarget&&a.mappedTarget.name)||a.connectionName||a.id||"(unnamed)";}\n' +
      '  function getXpath(a){var ad=a&&a._archiveDetail;if(!ad||!ad.expression)return "";return ad.expression.XpathExpression||ad.expression.TextExpression||"";}\n' +
      '  function trunc(x){if(!x)return "";return x.length<=60?x:x.substring(0,60)+"…";}\n' +
      '  function render(dn,depth){\n' +
      '    var node=document.createElement("div");node.className="iv-cmp-node iv-cmp-status-"+dn.status;node._diff=dn;\n' +
      '    var hasChildren=dn.children&&dn.children.length>0;\n' +
      '    var header=document.createElement("div");header.className="iv-cmp-node-header";\n' +
      '    var toggle=document.createElement("span");toggle.className="iv-cmp-toggle"+(hasChildren?"":" iv-cmp-leaf");toggle.textContent=hasChildren?"▶":"·";\n' +
      '    var sBadge=document.createElement("span");sBadge.className="iv-cmp-status-badge iv-cmp-status-badge-"+dn.status;\n' +
      '    sBadge.textContent=({added:"+",removed:"−",modified:"~",moved:"→",unchanged:"="})[dn.status];\n' +
      '    var tBadge=document.createElement("span");tBadge.className="iv-cmp-type-badge";tBadge.textContent=dispType(dn);tBadge.style.background=badgeColor(effType(dn));\n' +
      '    var p=dn.right||dn.left;\n' +
      '    var name=document.createElement("span");name.className="iv-cmp-node-name";name.textContent=p?activityName(p):"";\n' +
      '    header.appendChild(toggle);header.appendChild(sBadge);header.appendChild(tBadge);header.appendChild(name);\n' +
      '    node.appendChild(header);\n' +
      '    if(dn.status!=="unchanged"&&(dn.fieldDiffs&&dn.fieldDiffs.length>0||(dn.fileDiffs&&dn.fileDiffs.some(function(f){return f.status!=="unchanged";}))||dn.moved)){\n' +
      '      var body=document.createElement("div");body.className="iv-cmp-node-body";\n' +
      '      if(dn.moved){var m=document.createElement("div");m.className="iv-cmp-moved-line";m.innerHTML="<span class=\\\"iv-cmp-detail-label\\\">Moved:</span> <span class=\\\"iv-cmp-moved-from\\\">"+esc(dn.oldPath||"(root)")+"</span>  →  <span class=\\\"iv-cmp-moved-to\\\">"+esc(dn.newPath||"(root)")+"</span>";body.appendChild(m);}\n' +
      '      (dn.fieldDiffs||[]).forEach(function(f){var r=document.createElement("div");r.className="iv-cmp-field-diff";r.innerHTML="<span class=\\\"iv-cmp-detail-label\\\">"+esc(f.key)+"</span><span class=\\\"iv-cmp-old\\\">"+esc(f.oldValue==null?"(none)":f.oldValue)+"</span>  →  <span class=\\\"iv-cmp-new\\\">"+esc(f.newValue==null?"(none)":f.newValue)+"</span>";body.appendChild(r);});\n' +
      '      (dn.fileDiffs||[]).filter(function(f){return f.status!=="unchanged";}).forEach(function(f){\n' +
      '        var r=document.createElement("div");r.className="iv-cmp-file-row";\n' +
      '        r.innerHTML="<span class=\\\"iv-cmp-file-badge iv-cmp-file-"+f.status+"\\\">"+f.status.toUpperCase()+"</span><span class=\\\"iv-cmp-file-path\\\">"+esc(f.path)+"</span>";\n' +
      '        body.appendChild(r);\n' +
      '        if(f.status==="modified"&&f.lines){var pre=document.createElement("pre");pre.className="iv-cmp-line-diff";var h="";f.lines.forEach(function(l){var c=l.op==="+"?"iv-cmp-line-add":l.op==="-"?"iv-cmp-line-del":"iv-cmp-line-ctx";h+="<span class=\\""+c+"\\"><span class=\\"iv-cmp-line-op\\">"+l.op+"</span>"+esc(l.text)+"</span>\\n";});pre.innerHTML=h;body.appendChild(pre);}\n' +
      '      });\n' +
      '      header.style.cursor="pointer";header.addEventListener("click",function(e){if(e.target===toggle)return;body.classList.toggle("iv-cmp-open");header.classList.toggle("iv-cmp-header-active");});\n' +
      '      node.appendChild(body);\n' +
      '    }\n' +
      '    if(hasChildren){var cd=document.createElement("div");cd.className="iv-cmp-children";cd.style.display="none";dn.children.forEach(function(c){cd.appendChild(render(c,depth+1));});node.appendChild(cd);toggle.addEventListener("click",function(e){e.stopPropagation();var o=cd.style.display!=="none";cd.style.display=o?"none":"block";toggle.textContent=o?"▶":"▼";});}\n' +
      '    return node;\n' +
      '  }\n' +
      '  var tc=document.getElementById("iv-cmp-tree-container");\n' +
      '  tc.appendChild(render(diff,0));\n' +
      '  function applyFilters(){\n' +
      '    var q=(document.getElementById("iv-cmp-search").value||"").toLowerCase().trim();var cnt=0;\n' +
      '    function visit(el){var dn=el._diff;if(!dn)return false;var parts=[];function add(a){if(!a)return;DIFF_FIELDS.forEach(function(k){if(a[k])parts.push(String(a[k]));});if(a.mappedTarget&&a.mappedTarget.name)parts.push(a.mappedTarget.name);if(a._archiveDetail){var ad=a._archiveDetail;if(ad.expression)Object.keys(ad.expression).forEach(function(k){parts.push(String(ad.expression[k]||""));});if(ad.files)Object.keys(ad.files).forEach(function(k){parts.push(k);parts.push(ad.files[k]||"");});}}\n' +
      '      add(dn.left);add(dn.right);var txt=parts.join(" ").toLowerCase();var pass=true;if(q&&txt.indexOf(q)===-1)pass=false;if(showOnlyChanges&&dn.status==="unchanged")pass=false;var cc=el.querySelector(":scope > .iv-cmp-children");var any=false;if(cc)for(var i=0;i<cc.children.length;i++){if(visit(cc.children[i]))any=true;}var v=pass||any;el.classList.toggle("iv-cmp-hidden",!v);if(pass)cnt++;return v;}\n' +
      '    for(var i=0;i<tc.children.length;i++){if(tc.children[i].classList.contains("iv-cmp-node"))visit(tc.children[i]);}\n' +
      '    document.getElementById("iv-cmp-match-count").textContent=q?(cnt+" matches"):"";\n' +
      '  }\n' +
      '  document.getElementById("iv-cmp-search").addEventListener("input",applyFilters);\n' +
      '  document.getElementById("iv-cmp-only-changes").addEventListener("change",function(e){showOnlyChanges=e.target.checked;applyFilters();});\n' +
      '  document.getElementById("iv-cmp-expand").addEventListener("click",function(){document.querySelectorAll(".iv-cmp-children").forEach(function(el){el.style.display="block";});document.querySelectorAll(".iv-cmp-toggle").forEach(function(el){if(!el.classList.contains("iv-cmp-leaf"))el.textContent="▼";});});\n' +
      '  document.getElementById("iv-cmp-collapse").addEventListener("click",function(){document.querySelectorAll(".iv-cmp-children").forEach(function(el){el.style.display="none";});document.querySelectorAll(".iv-cmp-toggle").forEach(function(el){if(!el.classList.contains("iv-cmp-leaf"))el.textContent="▶";});});\n' +
      '  applyFilters();\n' +
      '})();\n' +
      '<\/script>\n' +
      '</body></html>';

    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'compare_' +
      sanitizeFilename(cmpLeft.blueprint.code || 'left') + '_' + sanitizeFilename(cmpLeft.blueprint.version || '') +
      '_vs_' +
      sanitizeFilename(cmpRight.blueprint.code || 'right') + '_' + sanitizeFilename(cmpRight.blueprint.version || '') + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Expose hook for standalone mode (no-op in extension context)
  window.__oicIV = {
    loadArchiveFromFile: loadArchiveFromFile,
    openEmptyViewer: openEmptyViewer,
    openViewerWithData: openViewerWithData
  };

})();
