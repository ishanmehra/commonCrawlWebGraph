cc-backlinks CLI reference

Usage

```bash
npm run backlinks -- [domain ...] [top_n]
node ./src/cc-backlinks.js [domain ...] [top_n]
```

Arguments

- `domain` or `domain ...`: One or more hostnames to query. You can pass them as separate arguments or as a comma-separated list. If no domain is provided, the CLI defaults to `example.com`.
- `top_n`: Optional trailing integer that limits how many backlink rows are shown per domain. If omitted, the CLI shows all rows.
- `all`, `unlimited`, or `--all`: Optional trailing flag that disables the per-domain limit entirely.

Examples

```bash
npm run backlinks -- edzy.ai
npm run backlinks -- edzy.ai 25
npm run backlinks -- edzy.ai
npm run backlinks -- edzy.ai roots.io 50
npm run backlinks -- edzy.ai roots.io
npm run backlinks -- edzy.ai,roots.io,example.com 20
npm run backlinks -- edzy.ai,roots.io,example.com
npm run backlinks -- edzy.ai all
npm run backlinks -- edzy.ai roots.io unlimited
npm run backlinks -- edzy.ai,roots.io,example.com --all
node ./src/cc-backlinks.js www.edzy.ai
```

Environment variables

- `CC_RELEASE`: Common Crawl hyperlink graph release to use. Defaults to `cc-main-2026-jan-feb-mar`.
- `CC_THREADS`: Optional DuckDB thread count. Set this to a positive integer to override the default thread count.

Behavior

- The CLI downloads and caches the Common Crawl vertex and edge files under `~/.cache/cc-backlinks/<release>`.
- Download progress is printed in the terminal while files are streaming.
- If a `www.` hostname is not present in the vertex file, the CLI retries the apex domain without `www.`.
- Results are printed as CSV-like rows in the terminal, grouped by input domain.
- If a domain is not found in the selected release, the CLI continues to the next domain instead of stopping the whole run.
- A JSON report is written for each run under `backlink-reports/` in the repo root using the pattern `domain-DD-MM-YYYY.json`.
- The report body is raw JSON containing the request metadata and backlink rows.

Output columns

- `linking_domain`: The domain that links to the target.
- `host_count`: The `num_hosts` value from the Common Crawl vertex file for the linking domain.
- `edge_count`: The number of edges found for that linking domain.

npm run backlinks -- edzy.ai, brainly.in, doubtnut.com, findfilo.com, kunduz.com, snapsolve.com, socratic.org, photomath.com, qanda.ai, mentormatch.com, byjus.com, vedantu.com, unacademy.com, pw.live, toppr.com, extramarks.com, embibe.com, khanacademy.org, infinitylearn.com, cuemath.com, meritnation.com, edurev.in, esaral.com, vidyakul.com, odaclass.com, practically.com, learnohub.com, adda247.com, brighttutee.com, geneo.in, fliplearn.com, stepapp.ai, allendigital.in, aakash.ac.in, oswaal360.com, learncbse.in, mycbseguide.com, teachoo.com, tiwariacademy.com, aglasem.com, jagranjosh.com, studyrankers.com, successcds.net, cbsetuts.com, entrancei.com, aplustoppers.com, meritexam.com, selfstudys.com, ncertbooksguru.com, toprankers.com, gauthmath.com, mathway.com, symbolab.com, wolframalpha.com, cymath.com, quizlet.com, cheggindia.com, coursehero.com, urbanpro.com, teacheron.com, superprof.co.in, preply.com, ziyyara.com, guruq.in, studymateonline.com, swiftchat.ai, speedlabs.in, taghive.in, mindspark.in, idreameducation.org, dronstudy.com, avanti.in, homerevise.co.in, letstute.com, bodhguru.com, nexteducation.in, marksharks.com, edubrisk.com, fiitjee-eschool.com, motion.ac.in, narayanagroup.com, resodigital.in, diksha.gov.in, epathshala.nic.in, swayam.gov.in, olabs.edu.in, shaalaa.com, flexiprep.com, cbseguess.com, kopykitab.com, studykhazana.com, notesgen.com, olympiadsuccess.com, respaper.com, clearexam.ac.in, edugorilla.com, notopedia.com, gyanampub.com, gyaan.ai, teachbetter.ai, gyanis.ai, swavid.com, dearsir.in, magnetbrains.com, padhle.in, shobhitnirwan.com, bhaikipadhai.com, leadschool.in, teachmint.com, classplusapp.com, nextlearningplatform.com, eupheus.in, tinkerly.com, whitehatjr.com, campk12.com, brightchamps.com, code.org, geeksforgeeks.org, brilliant.org, ck12.org, desmos.com, testbook.com, careerlauncher.com, time4education.com, vidyamandir.com, mtg.in, arihantbooks.com, goyal-books.com, fullmarks.org, imustudy.com, edza.ai, sigiq.ai, studyx.ai, upstudy.com, picanswer.ai, binogi.com, unifiedcouncil.com, olympiadtester.in, indiantalent.org, silverzone.org, logiqids.com, eduhealfoundation.org, crestolympiads.com, ei-india.com, curiousjr.com, oswaalbooks.com, schandpublishing.com, rachnasagar.in, vivaeducation.com, cordova.co.in, cybernetyx.com, tataclassedge.com, symphonia.in, schoolnetindia.com, butterflyfields.com, chalk20.com, educomp.com, entrar.in, mathbuddy.in, englishedge.in, tynker.com, skilledsapiens.com, thelearnary.com, homilab.in, stepupacademy.in, zishaan.ai, edubridgeindia.com, convegenius.ai, 21kschool.com, cyboardschool.com, k8school.com, vrukksha.com, dreamtimelearninghub.com, ixl.com, education.com, matific.com, mangahigh.com, explorelearning.com, brainpop.com, discoveryeducation.com, zearn.org, masterclass.com, cbseacademic.nic.in, ncert.nic.in, sarthaks.com, brainkart.com, learninsta.com, amrita.olabs.edu.in, chemcollective.org, biodigital.com, virtulab.com, aina.in, meratutor.ai, thinkup.ai, littleaimaster.com, evertutor.ai, hanasapp.com, breezeai.com, stepwisemath.ai, utkarsh.com, srichaitanya.net, uolo.com, jenni.ai, consensus.app, grammarly.com, quillbot.com, gamma.app, explainpaper.com, scholarcy.com, zotero.org, codingninjas.com, tekie.in, miko.ai, avishkaar.cc, stempedia.com, dcodeai.com, numerade.com, makersmuse.in, soar.gov.in, stemrob.com, jetlearn.com, algorithmics.com, supercoder.in, mindchamp.in, elicit.org, chatpdf.com, askyourpdf.com, athenaeducation.co.in, crimsoneducation.org, justtutors.com, edvi.app, clapingo.com, fastresult.in, educart.co, examgoal.com, ixrlabs.com, skidos.com, duolingo.com, ailiteracyacademy.com, codejoy.com, groklearning.com, hummingbirdeducation.com, vvm.org.in, meradost.ai, ifda.ai, gyaansathi.ai, studyspace.ai, vidyalay.ai, tutorgpt.in, cognilearn.ai, loomi.ai, aadhar.ai, researchrabbit.ai, scite.ai, tableau.com, labinapp.com, simulab.com, melscience.com, robokart.com, zspace.com, nearpod.com, classvr.com, arduino.cc, sunbeamonline.com, heritageonline.in, aits.com, creativeedge.in, entrancecheck.com, mockers.in, toppersbulletin.com, cbsemaster.com, babbel.com, memrise.com, doubtgo.com, answer.ai, nerdsnap.ai, helpai.app, tutorai.me, studdy.ai, homeworkai.app, questionai.com, arivihan.com, eprashala.com, topscorer.in, wordtune.com, scribehow.com, supatutor.com, chegg.com, indiabix.com

run on edzy npm run import:competitor-backlinks
npm run import:competitor-backlinks -- --dry-run
npm run import:competitor-backlinks -- --dateString=21-04-2026
npm run import:competitor-backlinks -- --file=backlink-reports\brainly.in-21-04-2026.json

npm run backlinks -- srichaitanya.net, uolo.com, jenni.ai, consensus.app, grammarly.com, quillbot.com, gamma.app, explainpaper.com, scholarcy.com, zotero.org, codingninjas.com, tekie.in, miko.ai, avishkaar.cc, stempedia.com, dcodeai.com, numerade.com, makersmuse.in, soar.gov.in, stemrob.com, jetlearn.com, algorithmics.com, supercoder.in, mindchamp.in, elicit.org, chatpdf.com, askyourpdf.com, athenaeducation.co.in, crimsoneducation.org, justtutors.com, edvi.app, clapingo.com, fastresult.in, educart.co, examgoal.com, ixrlabs.com, skidos.com, duolingo.com, ailiteracyacademy.com, codejoy.com, groklearning.com, hummingbirdeducation.com, vvm.org.in, meradost.ai, ifda.ai, gyaansathi.ai, studyspace.ai, vidyalay.ai, tutorgpt.in, cognilearn.ai, loomi.ai, aadhar.ai, researchrabbit.ai, scite.ai, tableau.com, labinapp.com, simulab.com, melscience.com, robokart.com, zspace.com, nearpod.com, classvr.com, arduino.cc, sunbeamonline.com, heritageonline.in, aits.com, creativeedge.in, entrancecheck.com, mockers.in, toppersbulletin.com, cbsemaster.com, babbel.com, memrise.com, doubtgo.com, answer.ai, nerdsnap.ai, helpai.app, tutorai.me, studdy.ai, homeworkai.app, questionai.com, arivihan.com, eprashala.com, topscorer.in, wordtune.com, scribehow.com, supatutor.com, chegg.com, indiabix.com

npm run backlinks -- eduro.live
npm run backlinks -- iaspyq.com
npm run backlinks -- monomousumi.com, readwritetips.com, coachingkhojo.com
