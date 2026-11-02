# LinkedIn posters

Images for announcing freshed on LinkedIn. They are designed as posters, with real Studio crops used
as the hero, instead of plain screenshots. All UI shown is the demo with the fictional Brew coffee
app.

| File                            | Size                        | Use                                        |
| ------------------------------- | --------------------------- | ------------------------------------------ |
| `launch.png`                    | 2160×2700 (1080×1350 at 2x) | Launch post, single image                  |
| `concept.png`                   | 2160×2700                   | Follow-up post about freshed ai            |
| `carousel/01.png` … `07.png`    | 2160×2700 each              | Carousel slides, also usable alone         |
| `carousel/freshed-carousel.pdf` | 7 pages, 1080×1350          | Upload as a LinkedIn document so it swipes |

Sources are in [`design/posters/`](../../../design/posters/) (HTML and CSS, no build step). To
re-render after a change, install dependencies first (the fonts come from the Studio's
`@fontsource-variable` packages), then:

```bash
node design/posters/render.mjs            # everything
node design/posters/render.mjs carousel   # one file while iterating
```

It uses the system Chrome (`CHROME_PATH` to override).

## launch.png

**Headline:** New screens. No store release.

**Alt text:**

> Poster for freshed, an open-source tool. Headline: "New screens. No store release." Subhead:
> "Compose screens from the components your Expo app already ships. Publish them as JSON." A phone
> shows the Brew coffee app's welcome screen, "Fresh beans, on your schedule", next to the freshed
> Studio editor and a JSON snippet describing the same Hero component. A chip reads "v3 live".
> Footer: Open source, free. mauriciomsouza.github.io/freshed. By Mauricio Souza, Design Engineer.

## concept.png

**Headline:** One prompt in. Draft screens out.

**Alt text:**

> Poster for freshed ai. Headline: "One prompt in. Draft screens out." Subhead: "Built from the
> components your app already ships, plus any it is missing, on a review branch. A human still
> publishes." A prompt card reads "Add a referral screen at the end of onboarding with a code to
> copy and a share button". Below it, a list of CMS drafts: an added screen "Give a bag, get a bag",
> two flow edges and a new ReferralCode component. An arrow leads to a phone showing the generated
> referral screen with the code BREW-ANA5 and a Share invite button, tagged "Draft, waiting for
> you". Footer: Open source, free. mauriciomsouza.github.io/freshed.

## Carousel

**Suggested document title:** freshed: ship new app screens without a store release

| Slide | Alt text                                                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Cover, 1 of 7. Headline: "What if app screens shipped like content?" A phone shows the Brew app's welcome screen beside a JSON snippet for the same screen. "Swipe" cue at the bottom.                                                                                                                 |
| 2     | 2 of 7, the problem. "A one-line copy fix is a full app release." A diff changes "Fresh beans, on schedule" to "Fresh beans, on your schedule", followed by four steps: Build, Store review, Rollout, Users update. Caption: "Four steps to add one word."                                             |
| 3     | 3 of 7, how it works. "Register the components you already ship." A code line registers Hero, Card, Button and List with FreshedProvider, above the Studio's component registry showing the Card component's preview and props table.                                                                  |
| 4     | 4 of 7, how it works. "Compose screens. Publish a version." The Studio's publish history lists three immutable versions, v3 live, each with a Roll back button. Chips: "GET /v1/flows/onboarding" and "v3 live, ETag / 304".                                                                           |
| 5     | 5 of 7, the design decision. "Data only. Old builds never break." A list of published versions with their protocol numbers. A new build sending protocol 2 gets v4; a two-year-old build sending protocol 1 gets the newest version it can read, and unknown components fall back instead of crashing. |
| 6     | 6 of 7, what makes it different. "AI drafts. Humans publish." The Generate with AI panel shows proposed drafts and generated component code on a review branch. Notes: self-hosted, your LLM key stays in your browser tab, no path lets AI publish or merge.                                          |
| 7     | 7 of 7. "Try the live demo." URL: mauriciomsouza.github.io/freshed. Three things to try: edit the welcome screen, click through onboarding, play an AI generation. A phone shows the delivery cadence step. Tag: Open source, free. MIT license.                                                       |
