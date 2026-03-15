import React, { useMemo, useState } from "react";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));
const pct = (value) => `${(value * 100).toFixed(1)}%`;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleBinomial(trials, probability, rng) {
  let successes = 0;
  for (let i = 0; i < trials; i += 1) {
    if (rng() < probability) successes += 1;
  }
  return successes;
}

function genotypeFromAlleles(p, F = 0) {
  const q = 1 - p;
  return {
    AA: p * p + F * p * q,
    Aa: 2 * p * q * (1 - F),
    aa: q * q + F * p * q,
  };
}

function allocateCounts(freqs, total) {
  const raw = freqs.map((f) => f * total);
  const base = raw.map((n) => Math.floor(n));
  let remainder = total - base.reduce((a, b) => a + b, 0);

  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainder; i += 1) {
    base[order[i % order.length].index] += 1;
  }

  return base;
}

function makePopulationSample(genotypes, total = 60) {
  const counts = allocateCounts([genotypes.AA, genotypes.Aa, genotypes.aa], total);
  return [
    ...Array.from({ length: counts[0] }, () => "AA"),
    ...Array.from({ length: counts[1] }, () => "Aa"),
    ...Array.from({ length: counts[2] }, () => "aa"),
  ];
}

function buildLinePath(points, width, height, yMin = 0, yMax = 1, pad = 28) {
  if (points.length <= 1) return "";
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  return points
    .map((y, i) => {
      const xPos = pad + (i / (points.length - 1 || 1)) * innerW;
      const yPos = pad + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;
      return `${i === 0 ? "M" : "L"}${xPos},${yPos}`;
    })
    .join(" ");
}

function SmallToggle({ checked, onChange, label, note }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs leading-5 text-slate-500">{note}</div>
      </div>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, help, valueLabel }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          <div className="text-xs leading-5 text-slate-500">{help}</div>
        </div>
        <div className="min-w-[72px] rounded-full bg-slate-100 px-3 py-1 text-right text-sm font-semibold text-slate-700">
          {valueLabel ?? value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-600"
      />
    </div>
  );
}

function BarGroup({ title, values, countBase, showCounts = true }) {
  const rows = [
    { key: "AA", label: "AA", value: values.AA, colour: "bg-sky-500" },
    { key: "Aa", label: "Aa", value: values.Aa, colour: "bg-violet-500" },
    { key: "aa", label: "aa", value: values.aa, colour: "bg-amber-500" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 text-sm font-semibold text-slate-800">{title}</div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{row.label}</span>
              <span className="text-slate-600">
                {pct(row.value)}
                {showCounts ? ` • ${Math.round(row.value * countBase)} of ${countBase}` : ""}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${row.colour} transition-all duration-500`}
                style={{ width: `${row.value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EquationChip({ children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
      {children}
    </div>
  );
}

function TaskCard({ title, prompt, onLoad }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mb-3 text-sm leading-6 text-slate-600">{prompt}</div>
      <button
        onClick={onLoad}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Load this scenario
      </button>
    </div>
  );
}

export default function HardyWeinbergInteractiveModel() {
  const equilibriumPreset = {
    p: 0.6,
    populationSize: 1000,
    generations: 12,
    inspectGeneration: 0,
    selectionOn: false,
    selectionStrength: 0,
    mutationOn: false,
    mu: 0,
    nu: 0,
    migrationOn: false,
    migrationRate: 0,
    migrantP: 0.3,
    driftOn: false,
    nonRandomOn: false,
    inbreeding: 0,
  };

  const [p, setP] = useState(equilibriumPreset.p);
  const [populationSize, setPopulationSize] = useState(equilibriumPreset.populationSize);
  const [generations, setGenerations] = useState(equilibriumPreset.generations);
  const [inspectGeneration, setInspectGeneration] = useState(equilibriumPreset.inspectGeneration);

  const [selectionOn, setSelectionOn] = useState(equilibriumPreset.selectionOn);
  const [selectionStrength, setSelectionStrength] = useState(equilibriumPreset.selectionStrength);

  const [mutationOn, setMutationOn] = useState(equilibriumPreset.mutationOn);
  const [mu, setMu] = useState(equilibriumPreset.mu);
  const [nu, setNu] = useState(equilibriumPreset.nu);

  const [migrationOn, setMigrationOn] = useState(equilibriumPreset.migrationOn);
  const [migrationRate, setMigrationRate] = useState(equilibriumPreset.migrationRate);
  const [migrantP, setMigrantP] = useState(equilibriumPreset.migrantP);

  const [driftOn, setDriftOn] = useState(equilibriumPreset.driftOn);
  const [nonRandomOn, setNonRandomOn] = useState(equilibriumPreset.nonRandomOn);
  const [inbreeding, setInbreeding] = useState(equilibriumPreset.inbreeding);
  const [driftSeed, setDriftSeed] = useState(1);

  const F = nonRandomOn ? inbreeding : 0;
  const q = 1 - p;

  const simulation = useMemo(() => {
    const rng = mulberry32(12345 + driftSeed * 9973 + populationSize * 17 + generations);
    let currentP = clamp(p, 0, 1);
    const history = [];

    for (let generation = 0; generation <= generations; generation += 1) {
      const currentQ = 1 - currentP;
      const expected = genotypeFromAlleles(currentP, 0);
      const matingGenotypes = genotypeFromAlleles(currentP, F);

      let actual = { ...matingGenotypes };
      if (selectionOn) {
        const fitnessAA = 1;
        const fitnessAa = 1;
        const fitnessaa = 1 - selectionStrength;
        const meanFitness =
          matingGenotypes.AA * fitnessAA +
          matingGenotypes.Aa * fitnessAa +
          matingGenotypes.aa * fitnessaa;

        actual = {
          AA: (matingGenotypes.AA * fitnessAA) / meanFitness,
          Aa: (matingGenotypes.Aa * fitnessAa) / meanFitness,
          aa: (matingGenotypes.aa * fitnessaa) / meanFitness,
        };
      }

      history.push({
        generation,
        p: currentP,
        q: currentQ,
        expected,
        actual,
      });

      if (generation === generations) break;

      let nextP = actual.AA + 0.5 * actual.Aa;

      if (mutationOn) {
        nextP = nextP * (1 - mu) + (1 - nextP) * nu;
      }

      if (migrationOn) {
        nextP = (1 - migrationRate) * nextP + migrationRate * migrantP;
      }

      if (driftOn) {
        const copiesOfA = sampleBinomial(populationSize * 2, nextP, rng);
        nextP = copiesOfA / (populationSize * 2);
      }

      currentP = clamp(nextP, 0, 1);
    }

    return history;
  }, [
    p,
    generations,
    populationSize,
    selectionOn,
    selectionStrength,
    mutationOn,
    mu,
    nu,
    migrationOn,
    migrationRate,
    migrantP,
    driftOn,
    F,
    driftSeed,
  ]);

  const inspected = simulation[Math.min(inspectGeneration, generations)] ?? simulation[0];
  const populationSample = makePopulationSample(inspected.actual, Math.min(60, populationSize));

  const linePath = buildLinePath(
    simulation.map((entry) => entry.p),
    640,
    260,
    0,
    1,
    28
  );

  const scenarioSummary = [
    selectionOn ? "selection on" : "no selection",
    mutationOn ? "mutation on" : "no mutation",
    migrationOn ? "migration on" : "no migration",
    driftOn ? "drift on" : "no genetic drift",
    nonRandomOn ? "non-random mating on" : "random mating",
  ];

  const resetEquilibrium = () => {
    setP(equilibriumPreset.p);
    setPopulationSize(equilibriumPreset.populationSize);
    setGenerations(equilibriumPreset.generations);
    setInspectGeneration(equilibriumPreset.inspectGeneration);
    setSelectionOn(equilibriumPreset.selectionOn);
    setSelectionStrength(equilibriumPreset.selectionStrength);
    setMutationOn(equilibriumPreset.mutationOn);
    setMu(equilibriumPreset.mu);
    setNu(equilibriumPreset.nu);
    setMigrationOn(equilibriumPreset.migrationOn);
    setMigrationRate(equilibriumPreset.migrationRate);
    setMigrantP(equilibriumPreset.migrantP);
    setDriftOn(equilibriumPreset.driftOn);
    setNonRandomOn(equilibriumPreset.nonRandomOn);
    setInbreeding(equilibriumPreset.inbreeding);
    setDriftSeed((s) => s + 1);
  };

  const loadScenario = (scenario) => {
    setP(scenario.p ?? equilibriumPreset.p);
    setPopulationSize(scenario.populationSize ?? equilibriumPreset.populationSize);
    setGenerations(scenario.generations ?? equilibriumPreset.generations);
    setInspectGeneration(scenario.inspectGeneration ?? 0);

    setSelectionOn(!!scenario.selectionOn);
    setSelectionStrength(scenario.selectionStrength ?? 0);

    setMutationOn(!!scenario.mutationOn);
    setMu(scenario.mu ?? 0);
    setNu(scenario.nu ?? 0);

    setMigrationOn(!!scenario.migrationOn);
    setMigrationRate(scenario.migrationRate ?? 0);
    setMigrantP(scenario.migrantP ?? equilibriumPreset.migrantP);

    setDriftOn(!!scenario.driftOn);
    setNonRandomOn(!!scenario.nonRandomOn);
    setInbreeding(scenario.inbreeding ?? 0);
    setDriftSeed((s) => s + 1);
  };

  const interpretation =
    !selectionOn && !mutationOn && !migrationOn && !driftOn && !nonRandomOn
      ? "Under Hardy–Weinberg equilibrium, allele frequencies stay constant and genotype frequencies match p², 2pq and q² in every generation."
      : selectionOn
      ? "Selection changes survival. If aa is selected against, the a allele usually becomes less common over time."
      : mutationOn
      ? "Mutation slowly changes allele frequencies by converting one allele into the other."
      : migrationOn
      ? "Migration adds alleles from another population, so the local gene pool shifts towards the migrants."
      : driftOn
      ? "Genetic drift causes random fluctuations, especially in small populations. A jagged line is a key clue."
      : "Non-random mating changes genotype frequencies first. It often reduces heterozygotes without changing p and q straight away.";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Hardy–Weinberg interactive model
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                See how allele frequencies and genotype frequencies are connected
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                This model starts with the ideal Hardy–Weinberg conditions. Then you can break one assumption at a time and watch what happens to allele frequency, genotype frequency and equilibrium.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={resetEquilibrium}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                title="Return to large population, random mating, no mutation, no migration and no selection."
              >
                Reset to equilibrium
              </button>
              {driftOn && (
                <button
                  onClick={() => setDriftSeed((s) => s + 1)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  title="Run the drift scenario again with a new random path."
                >
                  Re-sample drift
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {scenarioSummary.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Controls</h2>
              <div className="space-y-4">
                <Slider
                  label="Allele frequency p"
                  value={p}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => setP(clamp(value, 0, 1))}
                  help="p is the frequency of allele A in the population. q is automatically calculated as 1 − p."
                  valueLabel={round(p, 2)}
                />
                <Slider
                  label="Population size"
                  value={populationSize}
                  min={20}
                  max={2000}
                  step={10}
                  onChange={setPopulationSize}
                  help="Larger populations reduce the visible effect of genetic drift."
                  valueLabel={populationSize}
                />
                <Slider
                  label="Generations to simulate"
                  value={generations}
                  min={1}
                  max={50}
                  step={1}
                  onChange={(value) => {
                    setGenerations(value);
                    if (inspectGeneration > value) setInspectGeneration(value);
                  }}
                  help="The graph will show how p changes from generation 0 to the final generation."
                  valueLabel={generations}
                />
                <Slider
                  label="Generation to inspect"
                  value={Math.min(inspectGeneration, generations)}
                  min={0}
                  max={generations}
                  step={1}
                  onChange={setInspectGeneration}
                  help="Use this to inspect a particular generation in the bars and population sample below."
                  valueLabel={`G${Math.min(inspectGeneration, generations)}`}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Break one assumption</h2>
              <div className="space-y-3">
                <SmallToggle
                  checked={selectionOn}
                  onChange={setSelectionOn}
                  label="Natural selection"
                  note="Selection against aa changes survival, so allele frequencies can change across generations."
                />
                {selectionOn && (
                  <Slider
                    label="Selection against aa"
                    value={selectionStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={setSelectionStrength}
                    help="0 means no disadvantage. 1 means aa does not survive to reproduce."
                    valueLabel={round(selectionStrength, 2)}
                  />
                )}

                <SmallToggle
                  checked={mutationOn}
                  onChange={setMutationOn}
                  label="Mutation"
                  note="Mutation changes alleles directly. In this model, A can mutate to a and a can mutate to A."
                />
                {mutationOn && (
                  <div className="space-y-3">
                    <Slider
                      label="A → a mutation rate"
                      value={mu}
                      min={0}
                      max={0.1}
                      step={0.001}
                      onChange={setMu}
                      help="Usually small. Mutation often changes frequencies slowly."
                      valueLabel={round(mu, 3)}
                    />
                    <Slider
                      label="a → A mutation rate"
                      value={nu}
                      min={0}
                      max={0.1}
                      step={0.001}
                      onChange={setNu}
                      help="Use this to compare one-way and two-way mutation."
                      valueLabel={round(nu, 3)}
                    />
                  </div>
                )}

                <SmallToggle
                  checked={migrationOn}
                  onChange={setMigrationOn}
                  label="Migration"
                  note="Migration adds alleles from another population, so the gene pool may shift."
                />
                {migrationOn && (
                  <div className="space-y-3">
                    <Slider
                      label="Migration rate"
                      value={migrationRate}
                      min={0}
                      max={0.5}
                      step={0.01}
                      onChange={setMigrationRate}
                      help="This is the fraction of the population replaced by migrants each generation."
                      valueLabel={round(migrationRate, 2)}
                    />
                    <Slider
                      label="Allele frequency p in migrants"
                      value={migrantP}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={setMigrantP}
                      help="If the migrants have a different allele frequency, your population changes too."
                      valueLabel={round(migrantP, 2)}
                    />
                  </div>
                )}

                <SmallToggle
                  checked={driftOn}
                  onChange={setDriftOn}
                  label="Genetic drift"
                  note="Drift is random. Its effect is strongest when population size is small."
                />

                <SmallToggle
                  checked={nonRandomOn}
                  onChange={setNonRandomOn}
                  label="Non-random mating"
                  note="This model uses an inbreeding coefficient F, which increases homozygotes and reduces heterozygotes."
                />
                {nonRandomOn && (
                  <Slider
                    label="Inbreeding coefficient F"
                    value={inbreeding}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={setInbreeding}
                    help="F = 0 gives Hardy–Weinberg proportions. Higher F reduces heterozygotes."
                    valueLabel={round(inbreeding, 2)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Allele frequencies</h2>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                    Generation {inspected.generation}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <div className="text-sm font-semibold text-sky-900">Allele A</div>
                    <div className="mt-2 text-3xl font-bold text-sky-700">p = {round(inspected.p, 3)}</div>
                    <div className="mt-1 text-sm text-sky-900/80">Frequency of allele A</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">Allele a</div>
                    <div className="mt-2 text-3xl font-bold text-amber-700">q = {round(inspected.q, 3)}</div>
                    <div className="mt-1 text-sm text-amber-900/80">Frequency of allele a</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-800">Gene pool view</div>
                  <div className="mb-3 h-4 overflow-hidden rounded-full bg-slate-100">
                    <div className="flex h-full w-full">
                      <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${inspected.p * 100}%` }} />
                      <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${inspected.q * 100}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-10 gap-1.5">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-6 rounded-lg ${i < Math.round(inspected.p * 20) ? "bg-sky-500" : "bg-amber-500"}`}
                        title={i < Math.round(inspected.p * 20) ? "Allele A" : "Allele a"}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    These blocks show the gene pool. Blue blocks represent A and amber blocks represent a.
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Live equations</h2>
                <div className="grid gap-3">
                  <EquationChip>
                    <span className="font-semibold">p + q = 1</span>
                    <div className="mt-1 text-slate-600">
                      {round(inspected.p, 3)} + {round(inspected.q, 3)} = {round(inspected.p + inspected.q, 3)}
                    </div>
                  </EquationChip>
                  <EquationChip>
                    <span className="font-semibold">Expected Hardy–Weinberg genotype frequencies</span>
                    <div className="mt-1 text-slate-600">
                      AA = p² = {round(inspected.expected.AA, 3)} • Aa = 2pq = {round(inspected.expected.Aa, 3)} • aa = q² = {round(inspected.expected.aa, 3)}
                    </div>
                  </EquationChip>
                  <EquationChip>
                    <span className="font-semibold">Expected total</span>
                    <div className="mt-1 text-slate-600">
                      p² + 2pq + q² = {round(
                        inspected.expected.AA + inspected.expected.Aa + inspected.expected.aa,
                        3
                      )}
                    </div>
                  </EquationChip>
                  <EquationChip>
                    <span className="font-semibold">Actual genotype frequencies in this model</span>
                    <div className="mt-1 text-slate-600">
                      AA = {round(inspected.actual.AA, 3)} • Aa = {round(inspected.actual.Aa, 3)} • aa = {round(inspected.actual.aa, 3)}
                    </div>
                  </EquationChip>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-slate-800">Why this matters:</span> expected frequencies come from allele frequencies alone. Actual frequencies can differ when assumptions are broken.
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <BarGroup
                title="Expected genotype frequencies from p and q"
                values={inspected.expected}
                countBase={populationSize}
              />
              <BarGroup
                title="Actual genotype frequencies in the population"
                values={inspected.actual}
                countBase={populationSize}
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Change in allele frequency across generations</h2>
                  <p className="text-sm leading-6 text-slate-600">
                    The line shows how p changes from generation 0 to generation {generations}. In equilibrium it should stay flat.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {interpretation}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <svg viewBox="0 0 640 260" className="h-[260px] min-w-[640px] w-full">
                  {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                    const y = 28 + (1 - tick) * (260 - 56);
                    return (
                      <g key={tick}>
                        <line x1="28" x2="612" y1={y} y2={y} stroke="#cbd5e1" strokeDasharray="4 4" />
                        <text x="8" y={y + 4} fontSize="12" fill="#475569">
                          {tick.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  <line x1="28" x2="28" y1="28" y2="232" stroke="#334155" />
                  <line x1="28" x2="612" y1="232" y2="232" stroke="#334155" />

                  {simulation.map((entry, i) => {
                    const x = 28 + (i / (simulation.length - 1 || 1)) * (640 - 56);
                    return (
                      <text key={entry.generation} x={x} y="250" textAnchor="middle" fontSize="11" fill="#475569">
                        {entry.generation}
                      </text>
                    );
                  })}

                  <path d={linePath} fill="none" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

                  {simulation.map((entry, i) => {
                    const x = 28 + (i / (simulation.length - 1 || 1)) * (640 - 56);
                    const y = 28 + (1 - entry.p) * (260 - 56);
                    return (
                      <g key={`point-${entry.generation}`}>
                        <circle cx={x} cy={y} r="4.5" fill="#0284c7" />
                        <title>{`Generation ${entry.generation}: p = ${round(entry.p, 3)}`}</title>
                      </g>
                    );
                  })}

                  <text x="320" y="18" textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="600">
                    Allele frequency p
                  </text>
                </svg>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Population sample</h2>
                  <p className="text-sm leading-6 text-slate-600">
                    This sample shows the genotype mix in generation {inspected.generation}. It uses a display sample of up to 60 individuals.
                  </p>
                </div>
                <div className="text-sm text-slate-500">AA = blue • Aa = violet • aa = amber</div>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                {populationSample.map((genotype, index) => (
                  <div
                    key={`${genotype}-${index}`}
                    className={`flex h-12 items-center justify-center rounded-xl border text-sm font-semibold shadow-sm transition hover:scale-[1.03] ${
                      genotype === "AA"
                        ? "border-sky-200 bg-sky-100 text-sky-800"
                        : genotype === "Aa"
                        ? "border-violet-200 bg-violet-100 text-violet-800"
                        : "border-amber-200 bg-amber-100 text-amber-800"
                    }`}
                    title={`Genotype ${genotype}`}
                  >
                    {genotype}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Try this</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <TaskCard
                  title="Task 1: Pure equilibrium"
                  prompt="Set p = 0.7 under ideal conditions. What genotype frequencies do you expect? Does the line stay flat across generations?"
                  onLoad={() =>
                    loadScenario({
                      p: 0.7,
                      populationSize: 1000,
                      generations: 15,
                      inspectGeneration: 0,
                    })
                  }
                />
                <TaskCard
                  title="Task 2: Selection against aa"
                  prompt="Turn on selection against aa. Watch what happens to p over several generations. Which allele becomes more common?"
                  onLoad={() =>
                    loadScenario({
                      p: 0.5,
                      populationSize: 1000,
                      generations: 20,
                      inspectGeneration: 20,
                      selectionOn: true,
                      selectionStrength: 0.55,
                    })
                  }
                />
                <TaskCard
                  title="Task 3: Genetic drift"
                  prompt="Reduce the population strongly and turn on drift. What pattern in the graph suggests random change rather than directional change?"
                  onLoad={() =>
                    loadScenario({
                      p: 0.5,
                      populationSize: 30,
                      generations: 25,
                      inspectGeneration: 25,
                      driftOn: true,
                    })
                  }
                />
                <TaskCard
                  title="Task 4: Non-random mating"
                  prompt="Switch on non-random mating. Compare expected and actual genotype frequencies. Which genotype becomes less common first?"
                  onLoad={() =>
                    loadScenario({
                      p: 0.5,
                      populationSize: 1000,
                      generations: 8,
                      inspectGeneration: 0,
                      nonRandomOn: true,
                      inbreeding: 0.5,
                    })
                  }
                />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-slate-900">How to interpret this model</h2>
              <p className="text-sm leading-7 text-slate-600">
                Start by comparing the <span className="font-semibold text-slate-800">expected</span> genotype frequencies with the <span className="font-semibold text-slate-800">actual</span> genotype frequencies. Under Hardy–Weinberg equilibrium they match, and the allele frequency line stays flat. When you break an assumption, one of two things happens: either the allele frequencies themselves change over time, which means evolution is occurring, or the genotype frequencies move away from Hardy–Weinberg proportions even if p and q stay the same for the moment. The key idea is that allele frequency and genotype frequency are linked, but they are not the same thing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
