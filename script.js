const form = document.querySelector("#simulator-form");
const referenceInput = document.querySelector("#reference-string");
const frameInput = document.querySelector("#frame-count");
const algorithmInput = document.querySelector("#algorithm");
const randomButton = document.querySelector("#random-button");
const clearButton = document.querySelector("#clear-button");
const message = document.querySelector("#message");
const tableHead = document.querySelector("#table-head");
const tableBody = document.querySelector("#table-body");
const comparisonGrid = document.querySelector("#comparison-grid");

const faultCount = document.querySelector("#fault-count");
const hitCount = document.querySelector("#hit-count");
const hitRatio = document.querySelector("#hit-ratio");
const algorithmLabel = document.querySelector("#algorithm-label");

function parseReferenceString(value) {
    const cleaned = value.trim();

    if (!cleaned) {
        throw new Error("Enter at least one page number in the reference string.");
    }

    const tokens = cleaned.split(/[\s,]+/);
    const invalid = tokens.find((token) => !/^\d+$/.test(token));

    if (invalid) {
        throw new Error(`"${invalid}" is not a valid page number. Use whole numbers separated by spaces or commas.`);
    }

    return tokens.map(Number);
}

function validateInputs() {
    const references = parseReferenceString(referenceInput.value);
    const frames = Number(frameInput.value);

    if (!Number.isInteger(frames) || frames < 1) {
        throw new Error("Number of frames must be at least 1.");
    }

    if (frames > 10) {
        throw new Error("Use 10 frames or fewer so the table stays readable.");
    }

    return {
        references,
        frames,
        algorithm: algorithmInput.value
    };
}

function createEmptyFrames(frameCount) {
    return Array.from({ length: frameCount }, () => null);
}

function findReplacementIndex(algorithm, references, currentIndex, frames, loadedAt, lastUsed) {
    if (algorithm === "FIFO") {
        let oldestIndex = 0;
        let oldestTime = loadedAt[0];

        frames.forEach((_, index) => {
            if (loadedAt[index] < oldestTime) {
                oldestTime = loadedAt[index];
                oldestIndex = index;
            }
        });

        return oldestIndex;
    }

    if (algorithm === "LRU") {
        let leastRecentIndex = 0;
        let leastRecentTime = lastUsed[0];

        frames.forEach((_, index) => {
            if (lastUsed[index] < leastRecentTime) {
                leastRecentTime = lastUsed[index];
                leastRecentIndex = index;
            }
        });

        return leastRecentIndex;
    }

    let farthestIndex = 0;
    let farthestUse = -1;

    frames.forEach((page, index) => {
        const nextUse = references.indexOf(page, currentIndex + 1);

        if (nextUse === -1) {
            farthestIndex = index;
            farthestUse = Infinity;
            return;
        }

        if (nextUse > farthestUse) {
            farthestUse = nextUse;
            farthestIndex = index;
        }
    });

    return farthestIndex;
}

function simulate({ references, frames: frameCount, algorithm }) {
    const frames = createEmptyFrames(frameCount);
    const loadedAt = Array.from({ length: frameCount }, () => -1);
    const lastUsed = Array.from({ length: frameCount }, () => -1);
    const steps = [];
    let hits = 0;
    let faults = 0;

    references.forEach((page, index) => {
        const existingIndex = frames.indexOf(page);
        const hit = existingIndex !== -1;
        let changedFrame = existingIndex;

        if (hit) {
            hits += 1;
            lastUsed[existingIndex] = index;
        } else {
            faults += 1;
            const emptyIndex = frames.indexOf(null);
            changedFrame = emptyIndex !== -1
                ? emptyIndex
                : findReplacementIndex(algorithm, references, index, frames, loadedAt, lastUsed);

            frames[changedFrame] = page;
            loadedAt[changedFrame] = index;
            lastUsed[changedFrame] = index;
        }

        steps.push({
            step: index + 1,
            page,
            frames: [...frames],
            hit,
            changedFrame
        });
    });

    return {
        steps,
        hits,
        faults,
        ratio: references.length ? hits / references.length : 0
    };
}

function setMessage(text) {
    message.textContent = text;
    message.classList.toggle("show", Boolean(text));
}

function renderSummary(result, algorithm) {
    faultCount.textContent = result.faults;
    hitCount.textContent = result.hits;
    hitRatio.textContent = `${(result.ratio * 100).toFixed(2)}%`;
    algorithmLabel.textContent = algorithm;
}

function renderComparison({ references, frames }) {
    const algorithms = ["FIFO", "Optimal", "LRU"];
    const results = algorithms.map((algorithm) => ({
        algorithm,
        result: simulate({ references, frames, algorithm })
    }));

    const maxFaults = Math.max(...results.map((item) => item.result.faults), 1);
    const maxHits = Math.max(...results.map((item) => item.result.hits), 1);

    comparisonGrid.innerHTML = "";

    results.forEach(({ algorithm, result }) => {
        const card = document.createElement("div");
        card.className = "comparison-card";

        const title = document.createElement("h3");
        title.textContent = algorithm;
        card.appendChild(title);

        const faultRow = document.createElement("div");
        faultRow.className = "metric-row";
        faultRow.innerHTML = `
            <span>Faults</span>
            <span class="bar-outer"><span class="bar-fill fault" style="width: ${Math.round((result.faults / maxFaults) * 100)}%;"></span></span>
            <strong>${result.faults}</strong>
        `;
        card.appendChild(faultRow);

        const hitRow = document.createElement("div");
        hitRow.className = "metric-row";
        hitRow.innerHTML = `
            <span>Hits</span>
            <span class="bar-outer"><span class="bar-fill hit" style="width: ${Math.round((result.hits / maxHits) * 100)}%;"></span></span>
            <strong>${result.hits}</strong>
        `;
        card.appendChild(hitRow);

        const ratioRow = document.createElement("div");
        ratioRow.className = "metric-row";
        ratioRow.innerHTML = `
            <span>Hit Ratio</span>
            <span class="bar-outer"><span class="bar-fill ratio" style="width: ${(result.ratio * 100).toFixed(0)}%;"></span></span>
            <strong>${(result.ratio * 100).toFixed(1)}%</strong>
        `;
        card.appendChild(ratioRow);

        comparisonGrid.appendChild(card);
    });
}

function renderTable(result, frameCount) {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    const headRow = document.createElement("tr");
    ["Step", "Reference", ...Array.from({ length: frameCount }, (_, index) => `Frame ${index + 1}`), "Result"].forEach((heading) => {
        const th = document.createElement("th");
        th.textContent = heading;
        headRow.appendChild(th);
    });
    tableHead.appendChild(headRow);

    result.steps.forEach((step) => {
        const row = document.createElement("tr");
        row.className = step.hit ? "hit-row" : "fault-row";

        const cells = [step.step, step.page];
        cells.forEach((value) => {
            const td = document.createElement("td");
            td.textContent = value;
            row.appendChild(td);
        });

        step.frames.forEach((page, index) => {
            const td = document.createElement("td");
            td.className = page === null ? "frame-cell empty-frame" : "frame-cell";
            if (index === step.changedFrame) {
                td.classList.add(step.hit ? "changed-hit" : "changed-fault");
            }
            td.textContent = page === null ? "-" : page;
            td.title = index === step.changedFrame
                ? step.hit ? "Referenced page was already in this frame" : "Page loaded or replaced in this frame"
                : "Frame snapshot after this reference";
            row.appendChild(td);
        });

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = `status-badge ${step.hit ? "hit" : "fault"}`;
        badge.textContent = step.hit ? "Hit" : "Fault";
        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        tableBody.appendChild(row);
    });
}

function runSimulation() {
    try {
        const input = validateInputs();
        const result = simulate(input);
        renderSummary(result, input.algorithm);
        renderComparison(input);
        renderTable(result, input.frames);
        setMessage("");
    } catch (error) {
        setMessage(error.message);
    }
}

function generateRandomReference() {
    const length = Math.floor(Math.random() * 9) + 12;
    const maxPage = Math.floor(Math.random() * 5) + 5;
    const references = Array.from({ length }, () => Math.floor(Math.random() * (maxPage + 1)));
    referenceInput.value = references.join(" ");
    setMessage("");
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSimulation();
});

randomButton.addEventListener("click", () => {
    generateRandomReference();
    runSimulation();
});

clearButton.addEventListener("click", () => {
    referenceInput.value = "";
    tableHead.innerHTML = "";
    tableBody.innerHTML = '<tr><td class="empty-state">Run a simulation to see each reference and frame snapshot.</td></tr>';
    comparisonGrid.innerHTML = '<div class="comparison-empty">Run a simulation to compare all three algorithms.</div>';
    renderSummary({ faults: 0, hits: 0, ratio: 0 }, algorithmInput.value);
    setMessage("");
});
