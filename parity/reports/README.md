# Experiment reports

One file per experiment run: `experiment-<n>-<YYYY-MM-DD>.md`.

A report is not a summary of effort. It is the evidence that a question was
answered:

- the commit hash the numbers came from;
- the machine (CPU, GPU, driver, X11 or Wayland, display layout, refresh rate);
- the raw measurements, not just pass/fail;
- the criterion each measurement is checked against;
- the decision taken as a result, including "accepted deviation" and why.

`docs/experiments.md` defines the procedures and pass criteria. Link each report
back from there.
