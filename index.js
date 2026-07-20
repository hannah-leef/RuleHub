const OWNER = "Psuedonerd";
const REPO = "RuleHub";
const BRANCH = "master";

const ROOTS = [
  { folder: "Published", type: "Published" },
  { folder: "Examples", type: "Examples" },
  { folder: "Tutorials", type: "Tutorials" }
];

const TREE_API =
  `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;

const RAW_BASE =
  `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/${BRANCH}/`;

const GITHUB_BLOB_BASE =
  `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/`;

const GITHUB_TREE_BASE =
  `https://github.com/${OWNER}/${REPO}/tree/${BRANCH}/`;

const BNGLVIZ_PAGE =
  "https://bnglviz.github.io/bngl_bnglviz.html";

const RULES_RAILROAD_PAGE =
  "https://rulesrailroad.github.io/bngl_rrr.html";

const BNG_PLAYGROUND_PAGE =
  "https://ruleworld.github.io/bngplayground/";

const expandAllBtn = document.getElementById("expand-all");

const collapseAllBtn = document.getElementById("collapse-all");

const DEFAULT_VISIBLE_COLUMNS = [
  "source.origin",
  "name",
  "description",
  "tools",
  "simulate_tools",
  "ai_column",
];

const FEATURE_FILTER_COLUMNS = new Set([
  "compatibility.nfsim_compatible",
  "compatibility.bng2_compatible",
  "features.uses_compartments",
  "features.uses_energy",
  "features.uses_functions"
]);

const COMMENTED_OUT_COLUMN_CHECKBOXES = new Set([
  "file",
  "path",
  "id",
  "bngl_code",
  "bngl_file",
  "bngl_path",
  "yaml_file",
  "yaml_path",
  "github",
  "bngl_item",
  "yaml_github",
  "source.source_path",
  "playground.visible",
  "playground.featured",
  "playground.gallery_category",
  "playground.gallery_categories",
  "contributors",
  "parse_error",
  "collection.count",
  "collection.parent_model",
  "collection.type",
  "collection.variant_key",
  "source.original_format",
  "source.original_repository",
  "raw"
]);

const HIDDEN_COLUMN_CHECKBOXES = new Set([
  "playground.difficulty",
  "difficulty",
  "type",
  "bnglviz",
  "bngplayground",
  "rules_railroad",
  "compatibility.uses_compartments",
  "compatibility.uses_energy",
  "Features.uses_energy",
  "compatibility.uses_functions",
  "github_link",
  "features.uses_trash_molecules",
  "Features.uses_trash_molecules",
  "Features.uses_exclude_include_reactants",
  "features.uses_exclude_include_reactants",
  "Features.uses_functions",
  "features.uses_multiple_identical_sites",
  "Features.uses_multiple_identical_sites",
  "features.uses_anchors",
  "Features.uses_anchors",
  "features.uses_generate_network",
  "Features.uses_generate_network",
  "features.uses_moveconnected",
  "Features.uses_moveconnected",
  "features.uses_deletes_molecules",
  "Features.uses_deletes_molecules",
  "compatibility.vcell_compatible",
  "compatibility.molclustpy_compatible",
  "Features.default_sim_command",
  "Features.uses_totalrate",
  "Features.uses_compartments",
  "brief_ai",
  "compatibility.bnglviz_compatible",
  "compatibility.bngp_compatible",
  "compatibility.rr_compatible",
  "compatibility.vcell_errors",
  "features.default_sim_command",
  "features.uses_totalrate",
  "long_ai",
  ...FEATURE_FILTER_COLUMNS,
  ...COMMENTED_OUT_COLUMN_CHECKBOXES
]);

const NON_SORTABLE_COLUMNS = new Set([
  "bngl_code",
  "tools",
  "simulate_tools",
  "github",
  "github_link",
  "raw",
  "ai_column"
]);

const FUTURE_COLUMNS = new Set([
  "citation.year",
  "citation.pmid",
  "citation.doi",
  "biol_categories",
  "comp_categories"
]);

const COLUMN_LABELS = {
  "source.origin": "Source",
  "name": "BNGL Model",
  "description": "Description",
  "tags" : "Tags",
  "category": "Category",
  "bngl_code": "BNGL code",
  "tools": "Click to Visualize",
  "simulate_tools": "Click to Simulate",
  "citation.year": "Year",
  "citation.pmid": "PubMed ID",
  "citation.doi": "DOI",
  "biol_categories": "Biological Categories",
  "comp_categories": "Other Categories",
  "github": "GitHub",
  "github_link": "GitHub",
  "compatibility.simulation_methods": "Sim Methods",
  "ai_column": "AI Summaries",
  "citation.reference": "Reference"
};

let table;
let statusEl;
let searchEl;
let columnCheckboxesEl;
let pageSizeEl;
let pageSummaryEl;
let pageNumberEl;
let firstPageBtn;
let prevPageBtn;
let nextPageBtn;
let lastPageBtn;

let rows = [];
let columns = [];
let visibleColumns = new Set(DEFAULT_VISIBLE_COLUMNS);
let sortState = { column: "citation.year", direction: -1 };
let currentPage = 1;

function pathRoot(path) {
  return ROOTS.find(item => path === item.folder || path.startsWith(`${item.folder}/`)) || null;
}

function typeFromPath(path) {
  const root = pathRoot(path);
  return root ? root.type : "";
}

function isInTargetRoot(path) {
  return Boolean(pathRoot(path));
}

function isYamlPath(path) {
  return isInTargetRoot(path) && (path.endsWith(".yaml") || path.endsWith(".yml"));
}

function isBnglPath(path) {
  return isInTargetRoot(path) && path.endsWith(".bngl");
}

function dirname(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function basename(path) {
  return path.split("/").pop();
}

function flattenObject(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    output[prefix] = value.map(item => {
      if (item && typeof item === "object") return JSON.stringify(item);
      return String(item);
    }).join("; ");
    return output;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(nestedValue, nextPrefix, output);
    }
    return output;
  }

  output[prefix] = value == null ? "" : String(value);
  return output;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "Accept": "application/vnd.github+json" }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.text();
}

function getColumnLabel(column) {
  return COLUMN_LABELS[column] || column;
}

function normalizeDifficulty(value) {
  const text = String(value ?? "").trim().toLowerCase();

  if (text.includes("beginner") || text === "easy" || text === "introductory") return "beginner";
  if (text.includes("intermediate") || text === "medium") return "intermediate";
  if (text.includes("advanced") || text === "hard") return "advanced";

  return "";
}

function getRowDifficulty(row) {
  return normalizeDifficulty(
    row["playground.difficulty"] ||
    row["difficulty"] ||
    row["level"]
  );
}

function getSelectedDifficulties() {
  return new Set(
    [...document.querySelectorAll(".difficulty-checkbox:checked")]
      .map(input => input.value)
  );
}

function getSelectedTypes() {
  return new Set(
    [...document.querySelectorAll(".type-checkbox:checked")]
      .map(input => input.value)
  );
}

function rowMatchesType(row) {
  const selected = getSelectedTypes();

  if (!row["source.origin"]) {
    return selected.size > 0;
  }

  return selected.has(row["source.origin"]);
}

function getSelectedFeatureFilters() {
  return [...document.querySelectorAll(".feature-checkbox:checked")]
    .map(input => input.value);
}

function isTruthyYamlValue(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

function makeBnglVizUrl(item) {
  const url = new URL(BNGLVIZ_PAGE);
  url.searchParams.set("bngl", item.rawUrl);
  url.searchParams.set("label", item.label);
  url.searchParams.set("github", item.githubUrl);
  return url.toString();
}

function makeRulesRailRoadUrl(item) {
  const url = new URL(RULES_RAILROAD_PAGE);
  url.searchParams.set("bngl", item.rawUrl);
  url.searchParams.set("label", item.label);
  url.searchParams.set("github", item.githubUrl);
  return url.toString();
}

function makeBngPlaygroundUrl(item) {
  const url = new URL(BNG_PLAYGROUND_PAGE);
  url.searchParams.set("model", item.path);
  return url.toString();
}

function makeBnglItems(yamlPath, bnglPaths) {
  const yamlDir = dirname(yamlPath);
  const matchingBngl = bnglPaths.filter(path => dirname(path) === yamlDir);

  return matchingBngl.map(path => {
    const item = {
      path,
      label: basename(path),
      rawUrl: RAW_BASE + path,
      githubUrl: GITHUB_BLOB_BASE + path
    };

    item.bnglVizUrl = makeBnglVizUrl(item);
    item.rulesRailRoadUrl = makeRulesRailRoadUrl(item);
    item.bngPlaygroundUrl = makeBngPlaygroundUrl(item);

    return item;
  });
}

async function loadYamlFile(path, bnglPaths, aiFiles) {
  const rawUrl = RAW_BASE + path;
  const yamlGitHubUrl = GITHUB_BLOB_BASE + path;
  const readmeUrl = GITHUB_BLOB_BASE + dirname(path) + "/README.md";
  
  const folder = dirname(path);

const briefAi = aiFiles.find(file =>
  dirname(file) === folder &&
  file.endsWith("_aigenerated.md")
);

const longAi = aiFiles.find(file =>
  dirname(file) === folder &&
  file.endsWith("_coder.md")
);
  const bnglItems = makeBnglItems(path, bnglPaths);

  try {
    const text = await fetchText(rawUrl);
    const parsed = jsyaml.load(text) || {};
    const flat = flattenObject(parsed);
    console.log(flat);
console.log(flat["source.origin"]);
    if (bnglItems.length === 0) {
      return [{
        type: typeFromPath(path),
        file: basename(path),
        path,
        yaml_file: basename(path),
        yaml_path: path,
        github: readmeUrl,
        github_link: readmeUrl,
        yaml_github: yamlGitHubUrl,
        raw: rawUrl,
        bngl_item: null,
        tools: null,
        ...flat
      }];
    }

return bnglItems.map(item => ({
  type: typeFromPath(path),
  file: basename(path),
  path,
  yaml_file: basename(path),
  yaml_path: path,
  bngl_file: item.label,
  bngl_path: item.path,
  github: readmeUrl,
  github_link: readmeUrl,
  yaml_github: yamlGitHubUrl,
  raw: rawUrl,
  bngl_item: item,
  tools: item,

  brief_ai: briefAi ? GITHUB_BLOB_BASE + briefAi : null,
  long_ai: longAi ? GITHUB_BLOB_BASE + longAi : null,

  ...flat
}));
  } catch (error) {
    if (bnglItems.length === 0) {
      return [{
        type: typeFromPath(path),
        file: basename(path),
        path,
        yaml_file: basename(path),
        yaml_path: path,
        github: readmeUrl,
        github_link: readmeUrl,
        yaml_github: yamlGitHubUrl,
        raw: rawUrl,
        bngl_item: null,
        bnglviz: null,
        rules_railroad: null,
        bngplayground: null,
        parse_error: error.message
      }];
    }

   return bnglItems.map(item => ({
  type: typeFromPath(path),
  file: basename(path),
  path,
  yaml_file: basename(path),
  yaml_path: path,
  bngl_file: item.label,
  bngl_path: item.path,
  github: readmeUrl,
  github_link: readmeUrl,
  yaml_github: yamlGitHubUrl,
  raw: rawUrl,
  bngl_item: item,
  bnglviz: item,
  rules_railroad: item,
  bngplayground: item,

  brief_ai: briefAi ? GITHUB_BLOB_BASE + briefAi : null,
  long_ai: longAi ? GITHUB_BLOB_BASE + longAi : null,

  parse_error: error.message
}));
  }
}

async function loadAllMetadata() {
  statusEl.textContent = "Fetching repository tree from GitHub...";
  table.innerHTML = "";
  columnCheckboxesEl.innerHTML = "";

  const treeData = await fetchJson(TREE_API);

  if (treeData.truncated) {
    console.warn("GitHub returned a truncated tree. Some files may be missing.");
  }

  const allPaths = treeData.tree
    .filter(item => item.type === "blob")
    .map(item => item.path)
    .sort();

  const aiFiles = allPaths.filter(path =>
  path.endsWith("_aigenerated.md") ||
  path.endsWith("_coder.md")
);

  const allYamlPaths = allPaths.filter(isYamlPath);

  const yamlPaths = [];
  const folders = new Map();

  for (const path of allYamlPaths) {
    const slash = path.lastIndexOf("/");
    const folder = slash === -1 ? "" : path.substring(0, slash);

  if (!folders.has(folder)) {
    folders.set(folder, []);
  }
  folders.get(folder).push(path);
}

  for (const paths of folders.values()) {
   const namedMetadata = paths.find(p => /_metadata\.ya?ml$/i.test(p));

  if (namedMetadata) {
    yamlPaths.push(namedMetadata);
  } else {
    const metadata = paths.find(p => /\/metadata\.ya?ml$/i.test(p));
    if (metadata) {
      yamlPaths.push(metadata);
    }
  }
}
  const bnglPaths = allPaths.filter(isBnglPath);

  statusEl.textContent =
    `Found ${yamlPaths.length} YAML file(s) and ${bnglPaths.length} BNGL file(s). Loading metadata...`;

  const rowGroups = await Promise.all(
yamlPaths.map(path => loadYamlFile(path, bnglPaths, aiFiles))
  );

  rows = rowGroups.flat();

  console.log("rows:", rows.length);
  console.log(rows[0]);

  const allColumnNames = new Set();
  rows.forEach(row => Object.keys(row).forEach(key => allColumnNames.add(key)));

  const preferred = [
    "source.origin",
    "name",
    "citation.year",
    "citation.pmid",
    "citation.reference",
    "description",
    "tools",
    "simulate_tools",
    "ai_column",
    "citation.doi",
    "github_link",
    "bngl_item",
    "yaml_github",
    "bngl_file",
    "bngl_path",
    "yaml_file",
    "yaml_path",
    "file",
    "path",
    "id",
    "authors",
    "contributors",
    "date.created",
    "date.modified",
    "tags",
    "category",
    "biol_categories",
    "comp_categories",
    "compatibility.min_bng_version",
    "compatibility.simulation_methods",
    "source.source_path",
    "playground.visible",
    "playground.gallery_category",
    "playground.gallery_categories",
    "playground.featured",
    "raw",
    "features.uses_trash_molecules",
    "Features.uses_trash_molecules",
    "Features.uses_exclude_include_reactants",
    "features.uses_exclude_include_reactants",
    "Features.uses_energy",
    "Features.uses_functions",
    "features.uses_multiple_identical_sites",
    "Features.uses_multiple_identical_sites",
    "features.uses_anchors",
    "Features.uses_anchors",
    "features.uses_generate_network",
    "Features.uses_generate_network",
    "features.uses_moveconnected",
    "Features.uses_moveconnected",
    "features.uses_deletes_molecules",
    "Features.uses_deletes_molecules",
    "compatibility.vcell_compatible",
    "compatibility.molclustpy_compatible",
    "Features.default_sim_command",
    "Features.uses_totalrate",
    "Features.uses_compartments",
    "brief_ai",
    "compatibility.bnglviz_compatible",
    "compatibility.bngp_compatible",
    "compatibility.rr_compatible",
    "compatibility.vcell_errors",
    "features.default_sim_command",
    "features.uses_totalrate",
    "long_ai",
    "parse_error"
  ];

  columns = [
    ...preferred.filter(column =>
      (
        allColumnNames.has(column) ||
        FUTURE_COLUMNS.has(column) ||
        column === "source.origin" ||
        column === "tools" ||
        column === "simulate_tools" ||
        column === "github_link" ||
        column === "ai_column"
      ) &&
      !HIDDEN_COLUMN_CHECKBOXES.has(column)
    ),
    ...[...allColumnNames]
      .filter(column => !preferred.includes(column))
      .filter(column => !HIDDEN_COLUMN_CHECKBOXES.has(column))
      .sort()
  ];

  visibleColumns = new Set(
    DEFAULT_VISIBLE_COLUMNS.filter(column => columns.includes(column))
  );

  if (sortState.column && NON_SORTABLE_COLUMNS.has(sortState.column)) {
    sortState = { column: null, direction: 1 };
  }

  currentPage = 1;
  renderColumnCheckboxes();
  renderTable();
  updateStatus();
}

function renderColumnCheckboxes() {
  columnCheckboxesEl.innerHTML = columns.map(column => {
    const checked = visibleColumns.has(column) ? "checked" : "";
    const label = getColumnLabel(column);

    return `
      <label>
        <input type="checkbox" value="${escapeHtml(column)}" ${checked}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }).join("");

  columnCheckboxesEl.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("change", () => {
      if (input.checked) visibleColumns.add(input.value);
      else visibleColumns.delete(input.value);

      currentPage = 1;
      renderTable();
      updateStatus();
    });
  });
}

function renderSingleViewLink(item, urlKey, iconSrc, altText) {
  if (!item || !item[urlKey]) return "";

  return `<a href="${escapeHtml(item[urlKey])}" target="_blank" rel="noopener" title="${escapeHtml(item.label)}">
            <img src="${iconSrc}" alt="${altText}" width="30" height="30" style="vertical-align: middle;">
          </a>`;
}

function renderCell(column, value, row) {
  if (column === "github_link") {
    if (!value) return "";
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">view</a>`;
  }

  if (column === "github") {
    if (!value) return "";
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">view</a>`;
  }

  if (column === "raw") {
    if (!value) return "";
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">link</a>`;
  }

  if (column === "source.origin") {
    return `<span class="type-badge">${escapeHtml(value)}</span>`;
  }

if (column === "description") {
    if (!value) return "";

    if (row.raw) {
      
      const nfsimIcon = isTruthyYamlValue(row["compatibility.nfsim_compatible"])
        ? ` <img src="icons/NFsim.svg" width="25" alt="NFsim" title="NFsim Compatible">` : "";
        
      const bng2Icon = isTruthyYamlValue(row["compatibility.bng2_compatible"])
        ? ` <img src="icons/BNG2.svg" width="25" alt="BNG2" title="BNG2 Compatible">` : "";
  
      const compatibilityIcons = `${nfsimIcon}${bng2Icon}`;

      // 2. FEATURE ICONS (To be placed second)
      const energyIcon = isTruthyYamlValue(row["features.uses_energy"] ?? row["compatibility.uses_energy"])
        ? ` <img src="icons/einstein-equation.svg" width="25" alt="Energy" title="Uses Energy">` : "";

      const trashIcon = isTruthyYamlValue(row["features.uses_trash_molecules"] ?? row["compatibility.uses_trash_molecules"])
        ? ` <img src="icons/trash1.svg" width="25" alt="Trash Molecules" title="Uses Trash Molecules">` : "";

      const functionIcon = isTruthyYamlValue(row["features.uses_functions"] ?? row["compatibility.uses_functions"])
        ? ` <img src="icons/functions.svg" width="25" alt="Functions" title="Uses Functions">` : "";

      const vcellcompartmentsIcon = isTruthyYamlValue(row["features.uses_vcell_compartments"] ?? row["compatibility.uses_vcell_compartments"])
        ? ` <img src="icons/vcell-compartments.svg" width="25" alt="VCell Compartments" title="Uses VCell Compartments">` : "";

      const includeExcludeReactantsIcon = isTruthyYamlValue(row["features.uses_exclude_include_reactants"] ?? row["compatibility.uses_exclude_include_reactants"])
        ? ` <img src="icons/include_exclude_reactants.svg" width="25" alt="Exclude/Include Reactants" title="Uses Exclude/Include Reactants">` : "";

      const multipleIdenticalSitesIcon = isTruthyYamlValue(row["features.uses_multiple_identical_sites"] ?? row["compatibility.uses_multiple_identical_sites"])
        ? ` <img src="icons/multiple_sites.svg" width="25" alt="Multiple Identical Sites" title="Uses Multiple Identical Sites">` : "";
     
      const anchorsIcon = isTruthyYamlValue(row["features.uses_anchors"] ?? row["compatibility.uses_anchors"])
        ? ` <img src="icons/anchor.svg" width="25" alt="Anchors" title="Uses Anchors">` : "";

      /*const totalrateIcon = isTruthyYamlValue(row["features.uses_totalrate"] ?? row["compatibility.uses_totalrate"])  
      ? ` <img src="icons/totalrate.svg" width="25" alt="Total Rate" title="Uses Total Rate">` : "";*/

        const featureIcons = `${energyIcon}${functionIcon}${trashIcon}${vcellcompartmentsIcon}${includeExcludeReactantsIcon}${multipleIdenticalSitesIcon}${anchorsIcon}`;

      const githubLink = row.path 
        ? ` <a href="${escapeHtml(GITHUB_TREE_BASE + dirname(row.path))}" target="_blank" rel="noopener" style="margin-left: 8px; font-weight: 600;">GitHub</a>` : "";

      const yamlLink = row.raw 
        ? ` <a href="${escapeHtml(row.raw)}" target="_blank" rel="noopener" style="margin-left: 8px; font-weight: 600;">yaml</a>` : "";

        return `<span>${escapeHtml(value)}</span>${compatibilityIcons}${featureIcons}${githubLink}${yamlLink}`;
    }

    return escapeHtml(value);
  }

if (column === "tools") {
    if (!value) return "";

    let iconsHtml = "";

    iconsHtml += renderSingleViewLink(value, "bnglVizUrl", "icons/bngl.svg", "bnglViz");
    iconsHtml += renderSingleViewLink(value, "rulesRailRoadUrl", "icons/RR.svg", "RulesRailRoad");

   const modelFolder = row.yaml_file
  .replace(/_metadata\.ya?ml$/i, "")
  .replace(/\.ya?ml$/i, "");
    console.log("modelFolder =", modelFolder, "path =", row.path);

if (isTruthyYamlValue(row["compatibility.mpd_compatible"])) {
  iconsHtml += `
    <a href="https://github.com/vcellmike/MolecularProcessDiagram/tree/main/${encodeURIComponent(modelFolder)}"
       target="_blank"
       rel="noopener"
       title="Molecular Process Diagram">
      <img src="icons/mpd.png" alt="MPD" width="24">
    </a>`;
}

    return `<div style="display: flex; gap: 14px; align-items: center; padding-right: 18px;">${iconsHtml}</div>`;
}

if (column === "simulate_tools") {
    const item = row.tools;

    let iconsHtml = "";

    if (item) {
      iconsHtml += renderSingleViewLink(
        item,
        "bngPlaygroundUrl",
        "icons/BNGPlayground.svg",
        "bngPlayground"
      );
    }

    if (isTruthyYamlValue(row["compatibility.molclustpy_compatible"])) {
      iconsHtml += `
        <a href="https://molclustpy.github.io/"
           target="_blank"
           rel="noopener"
           title="MolClustPy">
          <img src="icons/Molclustpy.svg"
               alt="MCP"
               width="30"
               height="30"
               style="vertical-align: middle;">
        </a>`;
    }

    if (isTruthyYamlValue(row["compatibility.vcell_compatible"])) {
      iconsHtml += `
        <a href="http://vcell.org"
           target="_blank"
           rel="noopener"
           title="VCell">
          <img src="icons/vcell.svg"
               alt="VCell"
               width="30"
               height="30"
               style="vertical-align: middle;">
        </a>`;
    }

    return `<div style="display:flex; gap:14px; align-items:center; padding-right:18px;">
              ${iconsHtml}
            </div>`;
}

if (column === "ai_column") {
    let html = "";

    if (row.brief_ai) {
        html += `
        <a href="${escapeHtml(row.brief_ai)}"
           target="_blank"
           rel="noopener"
           title="Brief Biology Summary">
            <img src="icons/brief_AI.svg"
                 alt="Brief Biology Summary"
                 width="30"
                 height="30">
        </a>`;
    }

    if (row.long_ai) {
        html += `
        <a href="${escapeHtml(row.long_ai)}"
           target="_blank"
           rel="noopener"
           title="Detailed Coder Summary">
            <img src="icons/long_AI.svg"
                 alt="Detailed Coder Summary"
                 width="30"
                 height="30">
        </a>`;
    }

    return html;
}

  if (column === "name") {
    const difficulty = getRowDifficulty(row);
    const className = difficulty ? `difficulty-${difficulty}` : "";
    const label = value || row.bngl_file || row.file || "";
    const title = difficulty || "difficulty not specified";

    if (row.bngl_item && row.bngl_item.rawUrl) {
      return `
        <a
          class="model-name model-name-link ${className}"
          href="${escapeHtml(row.bngl_item.rawUrl)}"
          target="_blank"
          rel="noopener"
          title="${escapeHtml(title)}"
        >
          ${escapeHtml(label)}
        </a>
      `;
    }

    return `
      <span class="model-name ${className}" title="${escapeHtml(title)}">
        ${escapeHtml(label)}
      </span>
    `;
  }

  if (column === "citation.pmid") {
  if (!value) return "";

  const pmid = String(value).trim();

  return `
    <a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/"
       target="_blank"
       rel="noopener">
      PMID:${escapeHtml(pmid)}
    </a>
  `;
}

  return escapeHtml(value);

  if (column === "biol_categories") {
    return escapeHtml(row.category ?? "");
}

if (column === "comp_categories") {
    return escapeHtml(row.category ?? "");
}
}

function searchableText(value) {
  if (Array.isArray(value)) return value.map(item => searchableText(item)).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(item => searchableText(item)).join(" ");
  return String(value ?? "");
}

function rowMatchesSearch(row, query) {
  if (!query) return true;

  return Object.values(row).some(value =>
    searchableText(value).toLowerCase().includes(query)
  );
}

function rowMatchesDifficulty(row) {
  const selected = getSelectedDifficulties();
  const difficulty = getRowDifficulty(row);

  if (!difficulty) return selected.size > 0;
  return selected.has(difficulty);
}

function getFeatureFilterCandidates(column) {
  const candidates = [column];

  if (column.startsWith("compatibility.")) {
    candidates.push(column.replace("compatibility.", "features."));
  }

  if (column.startsWith("features.")) {
    candidates.push(column.replace("features.", "compatibility."));
  }

  return candidates;
}

function rowMatchesFeatureFilters(row) {
  const selectedFeatureFilters = getSelectedFeatureFilters();

  return selectedFeatureFilters.every(column => {
    const value = getFeatureFilterCandidates(column)
      .map(key => row[key])
      .find(item => item !== undefined);

    return value != null && isTruthyYamlValue(value);
  });
}

function getSelectedSimulationFilters() {
  return [...document.querySelectorAll(".simulation-checkbox:checked")]
    .map(input => input.value.toLowerCase());
}

function rowMatchesSimulationFilters(row) {
  const selected = getSelectedSimulationFilters();

  if (selected.length === 0) return true;

  const methods = String(
    row["compatibility.simulation_methods"] ?? ""
  ).toLowerCase();

  return selected.every(method => methods.includes(method));
}

function valueForSort(row, column) {
  const value = row[column];

  if (
    (column === "bnglviz" ||
     column === "rules_railroad" ||
     column === "bngplayground") &&
    value &&
    typeof value === "object"
  ) {
    return String(value.label ?? "").toLowerCase();
  }

  return String(value ?? "").toLowerCase();
}

function getFilteredSortedRows() {
  const query = searchEl.value.trim().toLowerCase();

  let filteredRows = rows
    .filter(row => rowMatchesSearch(row, query))
    .filter(row => rowMatchesDifficulty(row))
    .filter(row => rowMatchesType(row))
    .filter(row => rowMatchesFeatureFilters(row))
    .filter(row => rowMatchesSimulationFilters(row));

  if (sortState.column && !NON_SORTABLE_COLUMNS.has(sortState.column)) {
    const column = sortState.column;
    const direction = sortState.direction;

filteredRows = [...filteredRows].sort((a, b) => {
  if (column === "citation.year") {
    const ay = parseInt(a["citation.year"], 10);
    const by = parseInt(b["citation.year"], 10);

    const aMissing = isNaN(ay);
    const bMissing = isNaN(by);

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    return direction === 1
      ? ay - by
      : by - ay;
  }

  const av = valueForSort(a, column);
  const bv = valueForSort(b, column);

  return av.localeCompare(bv, undefined, {
    numeric: true,
    sensitivity: "base"
  }) * direction;
});
  }

  return filteredRows;
}

function getPageSize() {
  const value = pageSizeEl.value;
  return value === "all" ? "all" : Number(value);
}

function getTotalPages(totalRows) {
  const pageSize = getPageSize();
  if (pageSize === "all") return 1;
  return Math.max(1, Math.ceil(totalRows / pageSize));
}

function getPaginatedRows(filteredRows) {
  const pageSize = getPageSize();

  if (pageSize === "all") return filteredRows;

  const totalPages = getTotalPages(filteredRows.length);

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  return filteredRows.slice(start, end);
}

function renderTable() {
  const activeColumns = columns.filter(column => visibleColumns.has(column));
  const filteredRows = getFilteredSortedRows();
  const pageRows = getPaginatedRows(filteredRows);

  if (activeColumns.length === 0) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>No columns selected.</td>
        </tr>
      </tbody>
    `;
    updatePagination(filteredRows.length);
    return;
  }

  const headerHtml = `
    <thead>
      <tr>
        ${activeColumns.map(column => {
          if (NON_SORTABLE_COLUMNS.has(column)) {
            return `
              <th>
                <span class="th-content">
                  <span>${escapeHtml(getColumnLabel(column))}</span>
                </span>
              </th>
            `;
          }

          const isActive = sortState.column === column;
          const icon = isActive
            ? sortState.direction === 1 ? "A→Z" : "Z→A"
            : "↕";

          const title = isActive
            ? sortState.direction === 1
              ? "Sorted ascending. Click for descending."
              : "Sorted descending. Click for ascending."
            : "Sort alphanumerically";

          return `
            <th>
              <span class="th-content">
                <span>${escapeHtml(getColumnLabel(column))}</span>
                <button
                  class="sort-button ${isActive ? "active" : ""}"
                  data-column="${escapeHtml(column)}"
                  title="${escapeHtml(title)}"
                  aria-label="Sort ${escapeHtml(getColumnLabel(column))}"
                >${escapeHtml(icon)}</button>
              </span>
            </th>
          `;
        }).join("")}
      </tr>
    </thead>
  `;

  const bodyHtml = `
    <tbody>
      ${pageRows.map(row => `
        <tr>
          ${activeColumns.map(column =>
            `<td>${renderCell(column, row[column], row)}</td>`
          ).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;

  table.innerHTML = headerHtml + bodyHtml;

  table.querySelectorAll(".sort-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const column = button.dataset.column;

      if (NON_SORTABLE_COLUMNS.has(column)) {
        return;
      }

      if (sortState.column === column) {
        sortState.direction *= -1;
      } else {
        sortState = { column, direction: 1 };
      }

      currentPage = 1;
      renderTable();
    });
  });

  updatePagination(filteredRows.length);
}

function updatePagination(totalFilteredRows) {
  const pageSize = getPageSize();
  const totalPages = getTotalPages(totalFilteredRows);

  if (pageSize === "all") currentPage = 1;
  else currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const start = totalFilteredRows === 0
    ? 0
    : pageSize === "all"
      ? 1
      : (currentPage - 1) * pageSize + 1;

  const end = pageSize === "all"
    ? totalFilteredRows
    : Math.min(currentPage * pageSize, totalFilteredRows);

  pageSummaryEl.textContent =
    `Showing ${start}-${end} of ${totalFilteredRows} matching row(s).`;

  pageNumberEl.textContent =
    pageSize === "all"
      ? "Page 1 of 1"
      : `Page ${currentPage} of ${totalPages}`;

  firstPageBtn.disabled = currentPage <= 1 || pageSize === "all";
  prevPageBtn.disabled = currentPage <= 1 || pageSize === "all";
  nextPageBtn.disabled = currentPage >= totalPages || pageSize === "all";
  lastPageBtn.disabled = currentPage >= totalPages || pageSize === "all";
}

function updateStatus() {
  // Use row.type instead of row["source.origin"]
  const typeCounts = rows.reduce((acc, row) => {
    const modelType = row.type || "Unknown"; // Fallback just in case
    acc[modelType] = (acc[modelType] || 0) + 1;
    return acc;
  }, {});

  const summary = ["Published", "Examples", "Tutorials"]
    .map(type => `${type}: ${typeCounts[type] || 0}`)
    .join("; ");

  // Update hero statistics
  document.getElementById("modelCount").textContent =
    `${rows.length} Total Models`;

  document.getElementById("modelSummary").innerHTML = `
    <span class="stat published">
      Published: ${typeCounts.Published || 0}
    </span>
    <span class="stat examples">
      Examples: ${typeCounts.Examples || 0}
    </span>
    <span class="stat tutorials">
      Tutorials: ${typeCounts.Tutorials || 0}
    </span>
  `;

  statusEl.textContent =
    `Loaded ${rows.length} row(s) from YAML/BNGL file(s). Showing ${visibleColumns.size} column(s). ${summary}.`;
}

function getRowsForCsv() {
  return getFilteredSortedRows();
}

function csvValueForColumn(row, column) {
  if (column === "name" && row.bngl_item) {
    return row.bngl_item.rawUrl;
  }

  if (column === "description" && row.raw) {
    return row.raw;
  }

  if (column === "github_link") {
    return row.github_link || "";
  }

  if (column === "github") {
    return row.github || "";
  }

  if (column === "tools" && row[column]) {
      const item = row[column];
      const links = [];
      if (item.bnglVizUrl) links.push(item.bnglVizUrl);
      if (item.rulesRailRoadUrl) links.push(item.rulesRailRoadUrl);
      if (item.bngPlaygroundUrl) links.push(item.bngPlaygroundUrl);
     // if (item.molClustPyUrl) links.push(item.molClustPyUrl);
    return links.join("; ");
  }
    return row[column] ?? "";
  }

function downloadCsv() {
  const activeColumns = columns.filter(column => visibleColumns.has(column));
  const csvRows = getRowsForCsv();

  const csv = [
    activeColumns.map(column => csvEscape(getColumnLabel(column))).join(","),
    ...csvRows.map(row =>
      activeColumns
        .map(column => csvEscape(csvValueForColumn(row, column)))
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "rulehub-models-metadata-visible-columns.csv";
  link.click();

  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function initDomReferences() {
  table = document.getElementById("metadataTable");
  statusEl = document.getElementById("status");
  searchEl = document.getElementById("search");
  columnCheckboxesEl = document.getElementById("columnCheckboxes");

  pageSizeEl = document.getElementById("pageSize");
  pageSummaryEl = document.getElementById("pageSummary");
  pageNumberEl = document.getElementById("pageNumber");

  firstPageBtn = document.getElementById("firstPage");
  prevPageBtn = document.getElementById("prevPage");
  nextPageBtn = document.getElementById("nextPage");
  lastPageBtn = document.getElementById("lastPage");
}

function attachEventListeners() {

    const reloadBtn = document.getElementById("reload");
if (reloadBtn) {
    reloadBtn.addEventListener("click", loadAllMetadata);
}

const downloadBtn = document.getElementById("downloadCsv");
if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadCsv);
}

  document.querySelectorAll(".simulation-checkbox").forEach(input => {
  input.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
    });
  });

  document.getElementById("showDefault").addEventListener("click", () => {
    visibleColumns = new Set(DEFAULT_VISIBLE_COLUMNS.filter(column => columns.includes(column)));
    currentPage = 1;
    renderColumnCheckboxes();
    renderTable();
    updateStatus();
  });

  document.getElementById("restoreDefaults").addEventListener("click", () => {

    searchEl.value = "";

    expandAllBtn.addEventListener("click", () => {
  document.querySelectorAll(".filter-panel").forEach(panel => {
    panel.open = true;
  });
});

collapseAllBtn.addEventListener("click", () => {
  document.querySelectorAll(".filter-panel").forEach(panel => {
    panel.open = false;
  });
});

  document.querySelectorAll(".difficulty-checkbox")
    .forEach(cb => cb.checked = true);

// Source
  document.querySelectorAll(".type-checkbox")
    .forEach(cb => cb.checked = true);

// Everything else
  document.querySelectorAll(".feature-checkbox, .simulation-checkbox")
    .forEach(cb => cb.checked = false);
  
  visibleColumns = new Set(
    DEFAULT_VISIBLE_COLUMNS.filter(column => columns.includes(column))
  );
  renderColumnCheckboxes();

  sortState = { column: null, direction: 1 };

  currentPage = 1;

  renderTable();
  updateStatus();

  pageSizeEl.value = "50";
});

  document.getElementById("showAll").addEventListener("click", () => {
    visibleColumns = new Set(columns);
    currentPage = 1;
    renderColumnCheckboxes();
    renderTable();
    updateStatus();
  });

  document.getElementById("hideAll").addEventListener("click", () => {
    visibleColumns = new Set();
    currentPage = 1;
    renderColumnCheckboxes();
    renderTable();
    updateStatus();
  });

  searchEl.addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });

  document.querySelectorAll(".difficulty-checkbox").forEach(input => {
    input.addEventListener("change", () => {
      currentPage = 1;
      renderTable();
    });
  });

  document.querySelectorAll(".type-checkbox").forEach(input => {
    input.addEventListener("change", () => {
      currentPage = 1;
      renderTable();
    });
  });

  document.querySelectorAll(".feature-checkbox").forEach(input => {
    input.addEventListener("change", () => {
      currentPage = 1;
      renderTable();
    });
  });

  pageSizeEl.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  firstPageBtn.addEventListener("click", () => {
    currentPage = 1;
    renderTable();
  });

  prevPageBtn.addEventListener("click", () => {
    currentPage -= 1;
    renderTable();
  });

  nextPageBtn.addEventListener("click", () => {
    currentPage += 1;
    renderTable();
  });

  lastPageBtn.addEventListener("click", () => {
    const totalRows = getFilteredSortedRows().length;
    currentPage = getTotalPages(totalRows);
    renderTable();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initDomReferences();
  attachEventListeners();

  loadAllMetadata().catch(error => {
    console.error(error);
    statusEl.textContent = `Error: ${error.message}`;
  });
});
