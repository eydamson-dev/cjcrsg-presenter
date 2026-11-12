# Decision log

Every decision the AI makes on its own is recorded here (D15). The user reviews this
file, not each decision. An entry is written before the artefact it decides is
changed.

## Entry format

```
## DEC-nnn — short question
- **Date (UTC):**
- **Question:** the question, with the options
- **Leading option:**
- **Votes:** one line per voter: model, option, reason
- **Tally:** e.g. A 4 · B 1
- **Devil's advocate:** model, the objection in its words
- **Response:** the written answer to the objection
- **Decision:** the option chosen, and the artefacts changed (paths)
- **Touches an invariant or D-entry:** no / yes — which one
- **Reverses:** DEC-nnn, or none
- **Verifier status:** not applicable / pending / pass on <SHA> / fail
```

Numbers are never reused. A reversal is a new entry that cites the old one.

Before a vote, search this file for the same question. If it is already decided,
cite the old entry instead of voting again. A "no alternative found" note is also
an entry: `Decision: no alternative found, FreeShow behaviour used, no vote held`.

## Entries


## DEC-001 — Centre column: live preview or editable slide grid?
- **Date (UTC):** 2026-11-12
- **Question:** For the controller's centre column, show the live preview plus focus mode (A, the current implementation), or an editable slide grid as FreeShow does (B)?
- **Leading option:** A, by convention (status quo). Question file: `parity/reports/votes/DEC-001-centre-question-v1-unbalanced.txt` (facts favoured A; see caveat).
- **Votes:** DeepSeek v4.1 flash (free) A — the editor is not designed until DEV-013. GLM 5.3 flash (free) A — a grid would stall the controller before the editor exists. MiniMax 3.1 flash (free) A — live preview with focus mode serves operators now. Nemotron 3.5 lightning (free) A — live output control already works. MiMo v2.6 flash (free) A — editing waits on the unbuilt editor.
- **Tally:** A 5 · B 0
- **Devil's advocate:** `opencode/big-pickle` (free). The centre column is a passive mirror of the program monitor, so it spends the largest surface on something the operator already sees. Locking the layout before DEV-013 risks demoting the preview later: a cost paid twice.
- **Response:** The advocate is right that the preview duplicates the output. Option A is kept for the current phase only, because the slide editor has no design yet. Before DEV-013 designs the editor, the centre-column choice is reopened with a new entry. The preview is not a passive mirror in one respect: it is the operator's own check of what is live, which a grid does not provide.
- **Decision:** A for the current phase. No artefact changed beyond this log entry. The plan's centre-column item (`docs/plan.md`, Phase 7) stays open until DEV-013 is designed.
- **Touches an invariant or D-entry:** no.
- **Reverses:** none.
- **Verifier status:** not applicable (a design choice, not a behaviour under test).
- **Caveat on this vote:** the facts I wrote into the question file mentioned DEV-013 and the editor's absence, which points the voters at A. Five identical votes citing the same fact are weak evidence. Next time, the question file should list facts for both options with equal weight, and the leading option should be argued by one voter, not assumed.

## DEC-002 — Centre column, rerun with balanced facts
- **Date (UTC):** 2026-11-12
- **Question:** the same as DEC-001, with facts for A and B in equal number. Question file: `parity/reports/votes/DEC-002-centre-question.txt`.
- **Votes:** DeepSeek v4.1 flash (free) A — built and tested, avoids untested risk. GLM 5.3 flash (free) A — the grid is untested and depends on unfinished design. MiniMax 3.1 flash (free) A — already built and tested, avoids the DEV-013 dependency. Nemotron 3.5 lightning (free) A — built and tested, no untested grid risk. MiMo v2.6 flash (free) A — built, tested, no unfinished design needed.
- **Tally:** A 5 · B 0
- **Devil's advocate:** `opencode/big-pickle` (free). A cannot show anything beyond the live and next slide without navigation, so the operator cannot jump by sight. It gives up FreeShow familiarity. Its main advantage postpones the editing gap rather than closing it.
- **Response:** The objection is valid for the jump-by-sight case, and the current build does not support it. Accepted as a known limit for the current phase, to be decided again with DEV-013. Keyboard navigation to a slide by number already exists in the app (`docs/status.md`), so the loss is smaller than the objection suggests. The FreeShow-familiarity point is recorded under `docs/improvements.md` when the editor is designed.
- **Decision:** A for the current phase, unchanged from DEC-001. No artefact changed beyond this entry.
- **Touches an invariant or D-entry:** no.
- **Reverses:** none. It confirms DEC-001 with a balanced question.
- **Verifier status:** not applicable.
- **Caveat:** Both framings gave 5-0 for A. Votes that repeat "built and tested" may be following the one fact that is verifiable. The result is consistent with the status quo winning on merit, but this vote cannot show that the other option would lose on merit. Before a decision that matters more, the voters should be asked for an explicit score per option, not only a letter.
- **Script change in this session:** the advocate now argues against the majority winner, not a pre-set leading option. The question-file format is documented at the top of `parity/tools/vote.sh`.

## DEC-003 — Vote cost controls, paid fallback, and the researcher's model
- **Date (UTC):** 2026-11-12
- **Question:** how to keep votes and research cheap, and whether a paid model may stand in for a missing free one.
- **Votes:** none held. The user directed these changes, so there was no option to choose between.
- **Decision:**
  - The devil's advocate runs only when a vote is split or the question touches an invariant or a D-entry (`parity/tools/vote.sh`).
  - Gate 0 holds a vote only where the researcher finds a real alternative (`docs/plan.md`).
  - A voter whose free model is gone falls back to `opencode-go/deepseek-v4.1-flash`, only while its price is within the cap in `parity/tools/vote.sh`.
  - The `researcher` agent is pinned to `opencode-go/deepseek-v4.1-flash` (`.opencode/agents/researcher.md`).
  - Short sessions and the duplicate-question search are recorded in `AGENTS.md` and this file.
- **Why the fallback is the Go model:** `opencode/deepseek-v4.1-flash` (pay-as-you-go) returned "Insufficient balance" on this account. `opencode-go/deepseek-v4.1-flash` answered. The price cap is checked against the pay-as-you-go price list, because that list does not price Go models. Treat the cap as a proxy.
- **Touches an invariant or D-entry:** D15 wording changed (`docs/decisions.md`). No engine invariant.
- **Reverses:** none.
- **Verifier status:** not applicable. Tested: a fallback run with a missing free model, and a no-advocate run on a unanimous vote.

## DEC-004 — Orchestrator model: Claude Haiku 5.5 on the Go subscription
- **Date (UTC):** 2026-11-12
- **Question:** which model runs the orchestrator by default, and which billing path paid calls use.
- **Votes:** none held. The user directed it.
- **Decision:**
  - The default model is `opencode-go/claude-haiku-5-5`. Source of truth: `~/projects/dotfiles/packages/opencode/opencode.base.json`, rendered to `~/.config/opencode/opencode.json` with `scripts/render-config.py`.
  - Paid calls go through the Go subscription, never pay-as-you-go. Stated in `AGENTS.md`, and enforced in `parity/tools/vote.sh`, where a paid fallback must be `opencode-go/`.
  - Free `opencode/` models stay as voters, because they are not billed. The user was told this and has not objected.
- **Why Haiku:** on the pay-as-you-go list it is cheaper per token than DeepSeek (0.10 / 0.50 against 0.30 / 1.20 per 1M tokens). The Go plan is a subscription, so the list is a proxy. Quality as orchestrator is not yet measured; the trial is one full feature through the workflow.
- **Touches an invariant or D-entry:** no.
- **Reverses:** none. The earlier default, `opencode-go/deepseek-v4.1-flash#high`, is kept in the dotfiles history.
- **Verifier status:** not applicable. Tested: dry-run render shows only the model line changed; rendered config reads `opencode-go/claude-haiku-5-5`.
- **Not yet done:** the dotfiles change is not committed.

## DEC-005 — Voter panel: free models on OpenCode and Go, paid Go as the last link
- **Date (UTC):** 2026-11-12
- **Question:** which models vote, and what each voter falls back to.
- **Votes:** none held. The user directed it.
- **Decision:**
  - Each voter slot is a chain: a free OpenCode model, then a free Go model, then a paid Go model within the price cap (`parity/tools/vote.sh`).
  - Free Go models in use: `opencode-go/beam-free` and `opencode-go/longcat-2.5-free`. Both answered a test call.
  - `opencode-go/iceman-contributor-free` is not used: it needs a privacy setting turned on before it answers.
  - Paid pay-as-you-go models are never used. `AGENTS.md` states the order.
- **Limits to remember:** LongCat 2.5 Free allows 100 requests a day (OpenCode docs). A vote with two LongCat fallbacks uses two requests of that. Beam Free is not available in several countries, and it keeps prompts for 30 days.
- **Touches an invariant or D-entry:** no.
- **Reverses:** the voter list in DEC-003. Its slots are unchanged, with the Go fallbacks added.
- **Verifier status:** not applicable. Tested: the all-free path (five votes, advocate on a split or invariant question), and the chain with an unavailable free model (replaced by a Go free model, with the right message).

## DEC-006 — Vote script: runtime fallback, minimum votes, and the free usage limit
- **Date (UTC):** 2026-11-12
- **Question:** the vote failed in a test: most OpenCode free models answered "Free usage limit reached", and the script recorded a decision from one voter. How to stop that.
- **Votes:** none held. The fault was in the script, and the fix is a direct correction.
- **Finding:** the free OpenCode models share an account-wide free usage limit. It was reached during testing. Go free models (`opencode-go/beam-free`, `opencode-go/longcat-2.5-free`) and the paid Go DeepSeek model still answered.
- **Decision:**
  - A voter that fails at run time moves to the next link in its chain (`ask_chain` in `parity/tools/vote.sh`). Preflight checks prices, not whether a call will succeed; this covers the gap.
  - The vote aborts unless at least three votes arrive (`MIN_VOTES`). No decision is recorded on an abort.
  - The output reports distinct models against votes. Two Go free models cannot give five independent voters, so repeats are shown, not hidden.
  - The advocate uses the same chain.
  - Each voter's stdin is closed (`</dev/null`). Without it, `opencode run` read the rest of the chain and the fallbacks were never tried.
- **Not changed:** `opencode-go/iceman-contributor-free` is not in the panel. It answers now, but it is not in the public price list, so the script cannot confirm it is free.
- **Touches an invariant or D-entry:** no.
- **Reverses:** none.
- **Verifier status:** not applicable. Tested: the split question with the advocate, after the fix (five votes, three distinct models, advocate from the Go chain), and the all-free path before the free limit (DEC-005).
- **Open:** the free OpenCode limit resets on an unknown schedule. Until it does, the panel is effectively two free Go models plus the paid Go DeepSeek fallback. That is not five independent voters.

## DEC-007 — No free models, no vote: the orchestrator decides
- **Date (UTC):** 2026-11-12
- **Question:** what happens when the free models run out.
- **Votes:** none held. The user directed it.
- **Decision:**
  - Voting uses free models only. The paid Go DeepSeek fallback is removed from the voters. This supersedes the earlier instruction that paid Go models may vote, because the later instruction takes priority.
  - A vote needs at least three different free models to answer (`MIN_DISTINCT`). Otherwise `parity/tools/vote.sh` holds no vote and exits 4.
  - On exit 4, the orchestrator decides without a vote, and logs the entry as "decided without vote", with the reason and the models that failed.
  - `opencode-go/iceman-contributor-free` is not in the panel. Its price is not public.
- **Current state:** the free OpenCode models are blocked by the account usage limit, and two free Go models answer. Two different models is below the minimum, so votes are held off until the OpenCode limit resets or a third free model answers.
- **Touches an invariant or D-entry:** no.
- **Reverses:** the paid-fallback part of DEC-005 and DEC-006.
- **Verifier status:** not applicable. Tested: the current state returns exit 4 with two distinct models.

## DEC-008 — Voting scrapped; the AI decides and logs for later review
- **Date (UTC):** 2026-11-12
- **Question:** keep the vote, or drop it and let the AI decide alone?
- **Votes:** none held. The user decided, because the free-model quota kept running out.
- **Decision:**
  - `parity/tools/vote.sh` is deleted. The trial question files stay in `parity/reports/votes/` as history.
  - The AI decides features, contracts, `IMP` adoption and acceptance on its own (D16).
  - When it finds an alternative or an improvement, it implements it and logs it in `docs/improvements.md` as "adopted, pending review". The user reviews these later and decides what to keep.
  - The stop list in `AGENTS.md` still applies.
  - Recorded as D16, which supersedes D15.
- **Touches an invariant or D-entry:** D15 superseded by D16. No engine invariant.
- **Reverses:** DEC-001 through DEC-007 as operating rules. DEC-001 and DEC-002 keep their decision (live preview for the current phase), since that choice stands on its own.
- **Verifier status:** not applicable.

## DEC-009 — Model roles recorded in status; docs brought in line with D16
- **Date (UTC):** 2026-11-12
- **Question:** is Haiku still the orchestrator, and do the docs say so?
- **Votes:** none held. The user asked for the docs to be updated.
- **Decision:**
  - Orchestrator: `opencode-go/claude-haiku-5-5`. Confirmed in `~/.config/opencode/opencode.json`. This session runs on it.
  - Researcher: still `opencode-go/deepseek-v4.1-flash`. The cheaper-model trial is open; nothing was switched.
  - `docs/status.md` now has "How decisions are made now" and "Working models" sections, so the current state is in one place.
- **Touches an invariant or D-entry:** no.
- **Reverses:** none.
- **Verifier status:** not applicable. Checked: the live config reads Haiku; the researcher agent file reads DeepSeek.

## DEC-010 — Roles fixed: orchestrator on Haiku, researcher on DeepSeek
- **Date (UTC):** 2026-11-12
- **Question:** which model runs each role.
- **Votes:** none held. The user decided.
- **Decision:** the orchestrator is `opencode-go/claude-haiku-5-5`. The researcher is `opencode-go/deepseek-v4.1-flash`. The cheaper-model trial for the researcher is dropped. `docs/status.md` updated.
- **Touches an invariant or D-entry:** no.
- **Reverses:** the open trial in DEC-009.
- **Verifier status:** not applicable.

## DEC-011 — Subagent models
- **Date (UTC):** 2026-11-12
- **Question:** which subagents run on DeepSeek and which on Haiku.
- **Votes:** none held. The user approved the proposal.
- **Decision:**
  - Haiku (`opencode-go/claude-haiku-5-5`): `implementer`, `harness-engineer`, `scenario-author`. Pinned in `.opencode/agents/`.
  - DeepSeek (`opencode-go/deepseek-v4.1-flash`): `verifier`, `reader`, `vision-reader`, `researcher`, and the built-in `explore` and `plan`. The repo agents are pinned in `.opencode/agents/`; `explore` and `plan` are pinned in `~/projects/dotfiles/packages/opencode/opencode.base.json`.
  - The verifier is on a different model from the implementer, so the two do not share blind spots.
  - `general`, title, summary and compaction keep the default.
- **Checked:** `opencode run --agent explore` and `--agent plan` report `deepseek-v4.1-flash`. `opencode debug agents` shows the pinned repo agents. Both models accept images (price list), so `vision-reader` on DeepSeek is possible but not yet tested on a real screenshot.
- **Touches an invariant or D-entry:** no.
- **Reverses:** the default-inherit state of these subagents.
- **Verifier status:** not applicable.
