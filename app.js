  // Ved ændringer i denne fil: opdater ?v=<version> i index.html for at buste Cloudflare cache.
function $(id){ return document.getElementById(id); }
function splitCSV(s){ return (s||"").split(",").map(x=>x.trim()).filter(Boolean); }
function parseVlanDefs(raw){
  const defs = [];
  (raw||"").split(/\r?\n/).forEach(line => {
    const v = line.trim();
    if(!v) return;
    const [idPart, ...nameParts] = v.split(":");
    const id = (idPart||"").trim();
    if(!/^\d+$/.test(id)) return;
    const name = nameParts.join(":").trim();
    defs.push({ id, name });
  });
  return defs;
}
function derivePeerIp(ipCidr){
  const m = (ipCidr||"").trim().match(/^([0-9.]+)\s*\/\s*\d+$/);
  return m ? m[1] : (ipCidr||"").trim().split("/")[0];
}
function copyOut(id){ const el=$(id); el.select(); document.execCommand("copy"); }
let selectedOs = "onyx";
let siteModel = { sites: [] };

const CONFIG_IDS = [
  "swA","swB","swC","swD",
  "peerPo","peerBond","peerVlan","bridge","peerIpMode",
  "peerIpA","peerIpB","peerIpC","peerIpD",
  "onyxPeerPortsA","onyxPeerPortsB","onyxPeerPortsC","onyxPeerPortsD",
  "peerPortsA","peerPortsB","peerPortsC","peerPortsD",
  "sysmac1","sysmac2","backupA","backupB","backupC","backupD",
  "iplVlan1","iplIpA","iplIpB","iplVlan2","iplIpC","iplIpD",
  "vipName1","vipIp1","onyxSysmac1","vipName2","vipIp2","onyxSysmac2",
  "uplinkId","uplinkVlans","uplinkNative","uplinkOnyxA","uplinkOnyxB","uplinkOnyxC","uplinkOnyxD",
  "uplinkPortsA","uplinkPortsB","uplinkPortsC","uplinkPortsD",
  "siteId","siteVlans","siteNative","siteOnyxA","siteOnyxB","siteOnyxC","siteOnyxD",
  "sitePortsA","sitePortsB","sitePortsC","sitePortsD",
  "icPo","icBond","icVlans","icOnyxA","icOnyxB","icOnyxC","icOnyxD",
  "icPortsA","icPortsB","icPortsC","icPortsD",
  "vlanDefs"
];

function defaultSiteModelFromHostnames(){
  return {
    sites: [
      { name: "Site1", switches: [{ name: $("swA").value.trim() || "A" }, { name: $("swB").value.trim() || "B" }] },
      { name: "Site2", switches: [{ name: $("swC").value.trim() || "C" }, { name: $("swD").value.trim() || "D" }] }
    ]
  };
}

function normalizeSiteModel(model){
  const sites = Array.isArray(model?.sites) ? model.sites : [];
  return {
    sites: sites.map((site, i) => ({
      name: (site?.name || `Site${i+1}`).toString(),
      switches: (Array.isArray(site?.switches) ? site.switches : []).map((sw, j) => ({
        name: (sw?.name || `SW${j+1}`).toString()
      }))
    }))
  };
}

function flattenSwitchNamesFromSites(model){
  const names = [];
  (model.sites || []).forEach(site => (site.switches || []).forEach(sw => names.push(sw.name)));
  return names;
}

function syncHostnamesFromSiteModel(){
  const names = flattenSwitchNamesFromSites(siteModel);
  ["swA","swB","swC","swD"].forEach((id, idx) => {
    if(names[idx]) $(id).value = names[idx];
  });
}

function syncSiteModelFromHostnames(){
  if(!siteModel.sites.length){
    siteModel = defaultSiteModelFromHostnames();
  } else {
    const names = ["swA","swB","swC","swD"].map(id => $(id).value.trim()).filter(Boolean);
    let ptr = 0;
    siteModel.sites.forEach(site => {
      site.switches.forEach(sw => {
        if(ptr < names.length) sw.name = names[ptr++];
      });
    });
    while(ptr < names.length){
      if(!siteModel.sites.length) siteModel.sites.push({ name: "Site1", switches: [] });
      siteModel.sites[siteModel.sites.length - 1].switches.push({ name: names[ptr++] });
    }
  }
  renderSiteModel();
}

function renderSiteModel(){
  const sel = $("siteSelect");
  sel.innerHTML = "";
  siteModel.sites.forEach((site, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = site.name;
    sel.appendChild(opt);
  });
  const lines = siteModel.sites.map(site => {
    const switches = (site.switches || []).map(sw => sw.name).join(", ") || "(ingen)";
    return `${site.name}: ${switches}`;
  });
  $("siteList").textContent = lines.length ? lines.join(" | ") : "Ingen sites endnu.";
}

function collectConfigFromForm(){
  const config = {};
  CONFIG_IDS.forEach(id => {
    const el = $(id);
    if(!el) return;
    config[id] = el.value;
  });
  return config;
}

function applyConfigToForm(config){
  if(!config || typeof config !== "object") return;
  CONFIG_IDS.forEach(id => {
    const el = $(id);
    if(!el || !(id in config)) return;
    el.value = config[id];
  });
  if($("peerIpMode")) $("explicitPeerWrap").style.display = ($("peerIpMode").value==="explicit") ? "block" : "none";
}

function exportModelJson(){
  const payload = {
    version: "1.0",
    topology: { sites: siteModel.sites },
    config: collectConfigFromForm()
  };
  $("modelJson").value = JSON.stringify(payload, null, 2);
}

function importModelJson(){
  try{
    const parsed = JSON.parse($("modelJson").value);
    const importedSites = parsed?.topology?.sites || parsed?.sites || [];
    siteModel = normalizeSiteModel({ sites: importedSites });
    if(parsed?.config) applyConfigToForm(parsed.config);
    else syncHostnamesFromSiteModel();
    renderSiteModel();
    gen();
  } catch(e){
    alert("JSON kunne ikke parses. Tjek format.");
  }
}

function syncFocusButtons(grid){
  grid.querySelectorAll(".focus-btn").forEach(btn => btn.textContent = "Fokus");
  if(!grid.classList.contains("focus-mode")) return;
  const focused = grid.querySelector(".outpanel.focused");
  if(!focused) return;
  const btn = focused.querySelector(".focus-btn");
  if(btn) btn.textContent = "Tilbage";
}

function clearAllFocus(){
  document.querySelectorAll(".outgrid").forEach(grid => {
    grid.classList.remove("focus-mode");
    grid.querySelectorAll(".outpanel").forEach(panel => panel.classList.remove("focused"));
    syncFocusButtons(grid);
  });
}

function toggleFocus(outId){
  const panel = $(`panel-${outId}`);
  if(!panel) return;
  const grid = panel.closest(".outgrid");
  if(!grid) return;
  const alreadyFocused = grid.classList.contains("focus-mode") && panel.classList.contains("focused");
  grid.classList.remove("focus-mode");
  grid.querySelectorAll(".outpanel").forEach(p => p.classList.remove("focused"));
  if(!alreadyFocused){
    grid.classList.add("focus-mode");
    panel.classList.add("focused");
  }
  syncFocusButtons(grid);
}

function setOs(os){
  clearAllFocus();
  selectedOs = os;
  document.querySelectorAll(".os-onyx").forEach(el=>el.classList.toggle("hidden", os!=="onyx"));
  document.querySelectorAll(".os-cumulus").forEach(el=>el.classList.toggle("hidden", os!=="cumulus"));
    $("osOnyx").classList.toggle("active", os==="onyx");
    $("osCumulus").classList.toggle("active", os==="cumulus");
    $("osPill").textContent = `OS: ${os==="onyx" ? "Onyx" : "Cumulus"}`;
    $("tabBtnOnyx").classList.toggle("hidden", os!=="onyx");
    $("tabBtnCumulus").classList.toggle("hidden", os!=="cumulus");
    $("tabBtnOnyx").classList.toggle("active", os==="onyx");
    $("tabBtnCumulus").classList.toggle("active", os==="cumulus");
    $("tab-onyx").style.display = (os==="onyx") ? "block" : "none";
    $("tab-cumulus").style.display = (os==="cumulus") ? "block" : "none";
}

function setOutputTitles(swA, swB, swC, swD){
  $("onyxTitleA").textContent = `Onyx – ${swA}`;
  $("onyxTitleB").textContent = `Onyx – ${swB}`;
  $("onyxTitleC").textContent = `Onyx – ${swC}`;
  $("onyxTitleD").textContent = `Onyx – ${swD}`;
  $("cumTitleA").textContent = `Cumulus – ${swA}`;
  $("cumTitleB").textContent = `Cumulus – ${swB}`;
  $("cumTitleC").textContent = `Cumulus – ${swC}`;
  $("cumTitleD").textContent = `Cumulus – ${swD}`;
}

  function makeOnyxMlagBase(sw, peerPo, peerPorts, iplVlan, iplIp, iplPeerIp, vipName, sysmac){
    const lines = [];
    lines.push(`! ${sw} — MLAG basis (Onyx)`);
    lines.push(`configure terminal`);
    lines.push(`hostname ${sw}`);
    lines.push(`ip routing`);
    lines.push(`lacp`);
    lines.push(`protocol mlag`);
    lines.push(``);
    lines.push(`! Peerlink / IPL over Port-Channel ${peerPo}`);
    lines.push(`vlan ${iplVlan}`);
    lines.push(`interface port-channel ${peerPo}`);
    peerPorts.forEach(p => lines.push(`interface ethernet ${p} channel-group ${peerPo} mode active`));
    lines.push(`interface port-channel ${peerPo}`);
    lines.push(`ipl 1`);
    lines.push(`interface vlan ${iplVlan}`);
    lines.push(`mtu 9216`);
    lines.push(`ip address ${iplIp}`);
    lines.push(`ipl 1 peer-address ${iplPeerIp}`);
    lines.push(``);
    lines.push(`mlag-vip ${vipName}`);
    if(sysmac && sysmac.trim()){
      lines.push(`mlag system-mac ${sysmac.trim()}`);
    }
    lines.push(`no mlag shutdown`);
    lines.push(`end`);
    lines.push(`write memory`);
    return lines.join("\n");
  }

  function makeOnyxVipSet(sw, vipName, vipIp, isPrimary){
    const lines=[];
    lines.push(`! ${sw} — MLAG VIP (sæt IP på én switch, kun navn på peer)`);
    lines.push(`configure terminal`);
    if(isPrimary){
      lines.push(`mlag-vip ${vipName} ip ${vipIp.replace("/", " /")} force`);
    } else {
      lines.push(`mlag-vip ${vipName}`);
    }
    lines.push(`end`);
    lines.push(`write memory`);
    return lines.join("\n");
  }

  function makeOnyxMpo(sw, mpoId, ports, vlans, nativeVlan, label){
    const id = (mpoId||"").trim();
    if(!id || ports.length===0) return `! ${sw} — ${label}: (ingen porte angivet)`;
    const lines=[];
    lines.push(`! ${sw} — ${label} (MLAG-port-channel ${id})`);
    lines.push(`configure terminal`);
    lines.push(`interface mlag-port-channel ${id}`);
    lines.push(`mtu 9216`);
    ports.forEach(p => lines.push(`interface ethernet ${p} mlag-channel-group ${id} mode active`));
    lines.push(`interface mlag-port-channel ${id}`);
    lines.push(`switchport mode hybrid`);
    if(vlans && vlans.trim()){
      lines.push(`switchport hybrid allowed-vlan ${vlans.trim()}`);
    }
    if(nativeVlan && nativeVlan.trim()){
      lines.push(`switchport hybrid native-vlan ${nativeVlan.trim()}`);
    }
    lines.push(`no shutdown`);
    lines.push(`end`);
    lines.push(`write memory`);
    return lines.join("\n");
  }

function makeOnyxPortChannel(sw, poId, ports, vlans){
    const id=(poId||"").trim();
    if(!id || ports.length===0) return `! ${sw} — Interconnect: (springes over)`;
    const lines=[];
    lines.push(`! ${sw} — Interconnect (normal Port-Channel ${id})`);
    lines.push(`configure terminal`);
    lines.push(`lacp`);
    lines.push(`interface port-channel ${id}`);
    ports.forEach(p => lines.push(`interface ethernet ${p} channel-group ${id} mode active`));
    lines.push(`interface port-channel ${id}`);
    lines.push(`switchport mode trunk`);
    if(vlans && vlans.trim()) lines.push(`switchport trunk allowed vlan ${vlans.trim()}`);
    lines.push(`no shutdown`);
    lines.push(`end`);
    lines.push(`write memory`);
    return lines.join("\n");
}

function makeOnyxVlanDefs(sw, vlanDefs){
  if(!vlanDefs.length) return `! ${sw} — VLAN definitioner: (springes over)`;
  const lines = [];
  lines.push(`! ${sw} — VLAN definitioner`);
  lines.push(`configure terminal`);
  vlanDefs.forEach(v => {
    lines.push(`vlan ${v.id}`);
    if(v.name) lines.push(`name ${v.name}`);
  });
  lines.push(`end`);
  lines.push(`write memory`);
  return lines.join("\n");
}

  function makeCumulusMlagBase(sw, bridge, peerBond, peerPorts, peerVlan, sysmac, backupIp, peerIpMode, myPeerIpCidr, peerPeerIp){
    const ports = peerPorts.join(" ");
    const vlan = peerVlan;
    const lines=[];
    lines.push(`# ${sw} — MLAG basis (Cumulus ifupdown2)`);
    lines.push(`auto ${bridge}`);
    lines.push(`iface ${bridge}`);
    lines.push(`    bridge-vlan-aware yes`);
    lines.push(`    bridge-ports ${peerBond}`);
    lines.push(``);
    lines.push(`auto ${peerBond}`);
    lines.push(`iface ${peerBond}`);
    lines.push(`    bond-slaves ${ports}`);
    lines.push(``);
    lines.push(`auto ${peerBond}.${vlan}`);
    lines.push(`iface ${peerBond}.${vlan}`);
    lines.push(`    clagd-backup-ip ${backupIp}`);
    if(peerIpMode==="linklocal"){
      lines.push(`    clagd-peer-ip linklocal`);
    } else {
      lines.push(`    address ${myPeerIpCidr}`);
      lines.push(`    clagd-peer-ip ${peerPeerIp}`);
    }
    lines.push(`    clagd-sys-mac ${sysmac}`);
    return lines.join("\n");
  }

  function makeCumulusClagBond(sw, bridge, peerBond, bondName, ports, clagId, vlans, nativeVlan, label){
    const p = ports.join(" ");
    const id = (clagId||"").trim();
    if(!id || ports.length===0) return `# ${sw} — ${label}: (ingen porte angivet)`;
    const lines=[];
    lines.push(`# ${sw} — ${label} (bond + clag-id ${id})`);
    lines.push(`auto ${bondName}`);
    lines.push(`iface ${bondName}`);
    lines.push(`    bond-slaves ${p}`);
    lines.push(`    clag-id ${id}`);
    lines.push(``);
    lines.push(`# Tilføj ${bondName} til bridge som trunk`);
    lines.push(`# (merge bridge-ports/vids/pvid hvis du allerede har ${bridge})`);
    lines.push(`auto ${bridge}`);
    lines.push(`iface ${bridge}`);
    lines.push(`    bridge-vlan-aware yes`);
    lines.push(`    bridge-ports ${bondName} ${peerBond}`);
    if(vlans && vlans.trim()) lines.push(`    bridge-vids ${vlans.trim()}`);
    if(nativeVlan && nativeVlan.trim()) lines.push(`    bridge-pvid ${nativeVlan.trim()}`);
    return lines.join("\n");
  }

function makeCumulusBond(sw, bridge, peerBond, bondName, ports, vlans, label){
    const p = ports.join(" ");
    if(ports.length===0) return `# ${sw} — ${label}: (springes over)`;
    const lines=[];
    lines.push(`# ${sw} — ${label} (normal bond)`);
    lines.push(`auto ${bondName}`);
    lines.push(`iface ${bondName}`);
    lines.push(`    bond-slaves ${p}`);
    lines.push(``);
    lines.push(`# Tilføj ${bondName} til bridge`);
    lines.push(`auto ${bridge}`);
    lines.push(`iface ${bridge}`);
    lines.push(`    bridge-vlan-aware yes`);
    lines.push(`    bridge-ports ${bondName} ${peerBond}`);
    if(vlans && vlans.trim()) lines.push(`    bridge-vids ${vlans.trim()}`);
    return lines.join("\n");
}

function makeCumulusVlanDefs(sw, bridge, vlanDefs){
  if(!vlanDefs.length) return `# ${sw} — VLAN definitioner: (springes over)`;
  const lines = [];
  lines.push(`# ${sw} — VLAN definitioner`);
  vlanDefs.forEach(v => {
    lines.push(`auto vlan${v.id}`);
    lines.push(`iface vlan${v.id}`);
    lines.push(`    vlan-id ${v.id}`);
    lines.push(`    vlan-raw-device ${bridge}`);
    if(v.name) lines.push(`    alias ${v.name}`);
    lines.push(``);
  });
  return lines.join("\n").trimEnd();
}

  function overlapWarn(){
    if(selectedOs!=="onyx"){
      $("overlapWarn").style.display="none";
      $("overlapWarn").textContent="";
      return;
    }
    const warn=[];
    function check(name1, ports1, name2, ports2){
      const s1=new Set(ports1); const s2=new Set(ports2);
      const inter=[...s1].filter(x=>s2.has(x));
      if(inter.length) warn.push(`${name1} og ${name2} deler porte: ${inter.join(", ")}`);
    }
    check("Pair1 peerlink(A)", splitCSV($("onyxPeerPortsA").value), "Intersite(A)", splitCSV($("siteOnyxA").value));
    check("Pair1 peerlink(B)", splitCSV($("onyxPeerPortsB").value), "Intersite(B)", splitCSV($("siteOnyxB").value));
    check("Pair2 peerlink(C)", splitCSV($("onyxPeerPortsC").value), "Intersite(C)", splitCSV($("siteOnyxC").value));
    check("Pair2 peerlink(D)", splitCSV($("onyxPeerPortsD").value), "Intersite(D)", splitCSV($("siteOnyxD").value));
    const el=$("overlapWarn");
    if(warn.length){
      el.style.display="block";
      el.textContent="⚠️ Port overlap: " + warn.join(" | ") + "  (tjek kabling/portvalg)";
    } else {
      el.style.display="none";
      el.textContent="";
    }
  }

function gen(){
  const ids = ["A", "B", "C", "D"];
  const getText = id => ($(id)?.value || "").trim();
  const getCsv = id => splitCSV($(id)?.value || "");

  const hostnames = {
    A: getText("swA") || "A",
    B: getText("swB") || "B",
    C: getText("swC") || "C",
    D: getText("swD") || "D"
  };
  setOutputTitles(hostnames.A, hostnames.B, hostnames.C, hostnames.D);

  const peerPo = getText("peerPo") || "10";
  const peerBond = getText("peerBond") || "peerlink";
  const peerVlan = getText("peerVlan") || "4094";
  const bridge = getText("bridge") || "br_default";
  const peerIpMode = $("peerIpMode").value;
  const vlanDefs = parseVlanDefs($("vlanDefs").value);

  const uplinkId = getText("uplinkId");
  const uplinkVlans = getText("uplinkVlans");
  const uplinkNative = getText("uplinkNative");
  const siteId = getText("siteId");
  const siteVlans = getText("siteVlans");
  const siteNative = getText("siteNative");
  const icPo = getText("icPo");
  const icBond = getText("icBond");
  const icVlans = getText("icVlans");

  const pairData = {
    A: { pair: 1, mate: "B", isPrimary: true, iplVlan: getText("iplVlan1"), iplIp: getText("iplIpA"), vipName: getText("vipName1"), vipIp: getText("vipIp1"), onyxSysmac: getText("onyxSysmac1"), cumSysmac: getText("sysmac1"), backupIp: getText("backupA"), peerIp: getText("peerIpA") },
    B: { pair: 1, mate: "A", isPrimary: false, iplVlan: getText("iplVlan1"), iplIp: getText("iplIpB"), vipName: getText("vipName1"), vipIp: getText("vipIp1"), onyxSysmac: getText("onyxSysmac1"), cumSysmac: getText("sysmac1"), backupIp: getText("backupB"), peerIp: getText("peerIpB") },
    C: { pair: 2, mate: "D", isPrimary: true, iplVlan: getText("iplVlan2"), iplIp: getText("iplIpC"), vipName: getText("vipName2"), vipIp: getText("vipIp2"), onyxSysmac: getText("onyxSysmac2"), cumSysmac: getText("sysmac2"), backupIp: getText("backupC"), peerIp: getText("peerIpC") },
    D: { pair: 2, mate: "C", isPrimary: false, iplVlan: getText("iplVlan2"), iplIp: getText("iplIpD"), vipName: getText("vipName2"), vipIp: getText("vipIp2"), onyxSysmac: getText("onyxSysmac2"), cumSysmac: getText("sysmac2"), backupIp: getText("backupD"), peerIp: getText("peerIpD") }
  };

  const switches = ids.map(id => ({
    id,
    name: hostnames[id],
    outOnyx: `onyx${id}`,
    outCumulus: `cum${id}`,
    pair: pairData[id],
    onyxPeerPorts: getCsv(`onyxPeerPorts${id}`),
    peerPorts: getCsv(`peerPorts${id}`),
    uplinkOnyx: getCsv(`uplinkOnyx${id}`),
    uplinkPorts: getCsv(`uplinkPorts${id}`),
    siteOnyx: getCsv(`siteOnyx${id}`),
    sitePorts: getCsv(`sitePorts${id}`),
    icOnyx: getCsv(`icOnyx${id}`),
    icPorts: getCsv(`icPorts${id}`)
  }));

  if(selectedOs==="onyx"){
    switches.forEach(sw => {
      const peerIplIp = derivePeerIp(pairData[sw.pair.mate].iplIp);
      const base = makeOnyxMlagBase(
        sw.name,
        peerPo,
        sw.onyxPeerPorts,
        sw.pair.iplVlan,
        sw.pair.iplIp,
        peerIplIp,
        sw.pair.vipName,
        sw.pair.onyxSysmac
      );
      $(sw.outOnyx).value =
        makeOnyxVlanDefs(sw.name, vlanDefs)
        + "\n\n" + base
        + "\n\n" + makeOnyxVipSet(sw.name, sw.pair.vipName, sw.pair.vipIp, sw.pair.isPrimary)
        + "\n\n" + makeOnyxMpo(sw.name, uplinkId, sw.uplinkOnyx, uplinkVlans, uplinkNative, "Uplink")
        + "\n\n" + makeOnyxMpo(sw.name, siteId, sw.siteOnyx, siteVlans, siteNative, "Intersite")
        + "\n\n" + makeOnyxPortChannel(sw.name, icPo, sw.icOnyx, icVlans);
    });
  } else {
    switches.forEach(sw => { $(sw.outOnyx).value = ""; });
  }

  if(selectedOs==="cumulus"){
    switches.forEach(sw => {
      const peerPeerIp = derivePeerIp(pairData[sw.pair.mate].peerIp);
      let cfg =
        makeCumulusVlanDefs(sw.name, bridge, vlanDefs)
        + "\n\n" + makeCumulusMlagBase(
          sw.name,
          bridge,
          peerBond,
          sw.peerPorts,
          peerVlan,
          sw.pair.cumSysmac,
          sw.pair.backupIp,
          peerIpMode,
          sw.pair.peerIp,
          peerPeerIp
        );
      cfg += "\n\n" + makeCumulusClagBond(sw.name, bridge, peerBond, "uplink", sw.uplinkPorts, uplinkId, uplinkVlans, uplinkNative, "Uplink");
      cfg += "\n\n" + makeCumulusClagBond(sw.name, bridge, peerBond, "intersite", sw.sitePorts, siteId, siteVlans, siteNative, "Intersite");
      cfg += "\n\n" + makeCumulusBond(sw.name, bridge, peerBond, icBond, sw.icPorts, icVlans, "Interconnect");
      $(sw.outCumulus).value = cfg;
    });
  } else {
    switches.forEach(sw => { $(sw.outCumulus).value = ""; });
  }

  overlapWarn();
}

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    clearAllFocus();
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
      const tab = btn.dataset.tab;
      $("tab-onyx").style.display = (tab==="onyx") ? "block" : "none";
      $("tab-cumulus").style.display = (tab==="cumulus") ? "block" : "none";
    });
  });

  $("peerIpMode").addEventListener("change", ()=>{
    $("explicitPeerWrap").style.display = ($("peerIpMode").value==="explicit") ? "block" : "none";
  });
  $("osOnyx").addEventListener("click", ()=>{ setOs("onyx"); gen(); });
  $("osCumulus").addEventListener("click", ()=>{ setOs("cumulus"); gen(); });

  $("gen").addEventListener("click", gen);
  $("reset").addEventListener("click", ()=> location.reload());
  $("addSiteBtn").addEventListener("click", ()=>{
    const name = $("newSiteName").value.trim();
    if(!name) return;
    siteModel.sites.push({ name, switches: [] });
    $("newSiteName").value = "";
    renderSiteModel();
  });
  $("addSwitchBtn").addEventListener("click", ()=>{
    const siteIdx = Number($("siteSelect").value || "0");
    const name = $("newSwitchName").value.trim();
    if(!name || !siteModel.sites[siteIdx]) return;
    siteModel.sites[siteIdx].switches.push({ name });
    $("newSwitchName").value = "";
    renderSiteModel();
    syncHostnamesFromSiteModel();
    gen();
  });
  $("syncSitesBtn").addEventListener("click", ()=>{
    siteModel = defaultSiteModelFromHostnames();
    renderSiteModel();
    exportModelJson();
  });
  $("exportJsonBtn").addEventListener("click", exportModelJson);
  $("importJsonBtn").addEventListener("click", importModelJson);

  $("tplSn2010").addEventListener("click", ()=>{
    $("swA").value="SN2010-A"; $("swB").value="SN2010-B"; $("swC").value="SN2010-C"; $("swD").value="SN2010-D";
    $("peerPo").value="10";
    $("uplinkId").value="20";
    $("siteId").value="30";
    $("uplinkOnyxA").value="Eth1/18"; $("uplinkOnyxB").value="Eth1/18"; $("uplinkOnyxC").value="Eth1/18"; $("uplinkOnyxD").value="Eth1/18";
    $("onyxPeerPortsA").value="Eth1/21,Eth1/22"; $("onyxPeerPortsB").value="Eth1/21,Eth1/22"; $("onyxPeerPortsC").value="Eth1/21,Eth1/22"; $("onyxPeerPortsD").value="Eth1/21,Eth1/22";
    $("siteOnyxA").value="Eth1/20"; $("siteOnyxB").value="Eth1/20"; $("siteOnyxC").value="Eth1/20"; $("siteOnyxD").value="Eth1/20";
    $("uplinkPortsA").value="swp18"; $("uplinkPortsB").value="swp18"; $("uplinkPortsC").value="swp18"; $("uplinkPortsD").value="swp18";
    $("peerPortsA").value="swp21,swp22"; $("peerPortsB").value="swp21,swp22"; $("peerPortsC").value="swp21,swp22"; $("peerPortsD").value="swp21,swp22";
    $("sitePortsA").value="swp20"; $("sitePortsB").value="swp20"; $("sitePortsC").value="swp20"; $("sitePortsD").value="swp20";
    gen();
  });

  $("tplSn3400").addEventListener("click", ()=>{
    $("swA").value="SN3420-A"; $("swB").value="SN3420-B"; $("swC").value="SN3420-C"; $("swD").value="SN3420-D";
    $("peerPo").value="10";
    $("uplinkId").value="20";
    $("siteId").value="30";
    $("onyxPeerPortsA").value="Eth1/49,Eth1/50"; $("onyxPeerPortsB").value="Eth1/49,Eth1/50";
    $("onyxPeerPortsC").value="Eth1/49,Eth1/50"; $("onyxPeerPortsD").value="Eth1/49,Eth1/50";
    $("uplinkOnyxA").value="Eth1/53,Eth1/54"; $("uplinkOnyxB").value="Eth1/53,Eth1/54";
    $("uplinkOnyxC").value="Eth1/53,Eth1/54"; $("uplinkOnyxD").value="Eth1/53,Eth1/54";
    $("siteOnyxA").value="Eth1/47,Eth1/48"; $("siteOnyxB").value="Eth1/47,Eth1/48";
    $("siteOnyxC").value="Eth1/47,Eth1/48"; $("siteOnyxD").value="Eth1/47,Eth1/48";
    $("peerPortsA").value="swp49,swp50"; $("peerPortsB").value="swp49,swp50"; $("peerPortsC").value="swp49,swp50"; $("peerPortsD").value="swp49,swp50";
    $("uplinkPortsA").value="swp53,swp54"; $("uplinkPortsB").value="swp53,swp54"; $("uplinkPortsC").value="swp53,swp54"; $("uplinkPortsD").value="swp53,swp54";
    $("sitePortsA").value="swp47,swp48"; $("sitePortsB").value="swp47,swp48"; $("sitePortsC").value="swp47,swp48"; $("sitePortsD").value="swp47,swp48";
    gen();
  });

  siteModel = defaultSiteModelFromHostnames();
  renderSiteModel();
  exportModelJson();
  setOs("onyx");
  gen();
