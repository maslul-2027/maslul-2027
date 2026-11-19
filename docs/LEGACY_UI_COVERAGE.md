# Legacy API and mobile UI coverage

This static review uses the mobile Apps Script UI at `25b2e84` and the reviewed API inventory. A literal reference can identify a call, a dynamically assigned method name, or display text. Rows with no literal require tracing dynamic calls or identifying an administrative-only route. Runtime contract, permission, persistence and Google TEST evidence remain pending for every row in this matrix. The public Pages demo has no Google Apps Script connection.

| Operation | Backend registration | Mobile Apps Script UI reference |
|---|---|---|
| `courses.list` | [Code.gs:7](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L7) | [Index.html:182](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L182) |
| `courses.org` | [Code.gs:8](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L8) | [Index.html:187](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L187) |
| `courses.create` | [Code.gs:9](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L9) | [Index.html:803](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L803) |
| `courses.archive` | [Code.gs:10](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L10) | [Index.html:804](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L804) |
| `courses.reopen` | [Code.gs:11](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L11) | [Index.html:804](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L804) |
| `courses.rename` | [Code.gs:12](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L12) | Trace required |
| `users.list` | [Code.gs:13](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L13) | [Index.html:359](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L359), [Index.html:806](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L806) |
| `users.add` | [Code.gs:14](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L14) | [Index.html:805](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L805) |
| `users.set` | [Code.gs:15](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L15) | [Index.html:806](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L806) |
| `soldiers.list` | [Code.gs:16](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L16) | [Index.html:229](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L229), [Index.html:401](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L401), [Index.html:516](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L516), [Index.html:689](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L689) |
| `soldiers.card` | [Code.gs:17](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L17) | [Index.html:267](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L267), [Index.html:873](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L873) |
| `soldiers.private` | [Code.gs:18](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L18) | [Index.html:892](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L892) |
| `soldiers.create` | [Code.gs:22](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L22) | [Index.html:332](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L332) |
| `soldiers.update` | [Code.gs:23](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L23) | [Index.html:331](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L331) |
| `soldiers.reassign` | [Code.gs:24](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L24) | [Index.html:346](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L346) |
| `soldiers.setActive` | [Code.gs:25](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L25) | [Index.html:285](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L285) |
| `soldiers.cancel` | [Code.gs:26](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L26) | [Index.html:286](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L286) |
| `soldiers.restore` | [Code.gs:27](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L27) | [Index.html:282](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L282) |
| `emergency.get` | [Code.gs:19](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L19) | [Index.html:263](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L263), [Index.html:327](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L327) |
| `emergency.set` | [Code.gs:20](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L20) | [Index.html:261](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L261), [Index.html:333](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L333) |
| `emergency.orphans` | [Code.gs:21](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L21) | [Index.html:775](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L775), [Index.html:776](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L776) |
| `nav.create` | [Code.gs:28](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L28) | [Index.html:406](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L406) |
| `nav.list` | [Code.gs:29](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L29) | [Index.html:420](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L420) |
| `nav.groups` | [Code.gs:30](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L30) | [Index.html:410](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L410) |
| `nav.summary` | [Code.gs:40](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L40) | Trace required |
| `navtypes.list` | [Code.gs:31](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L31) | [Index.html:355](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L355), [Index.html:476](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L476) |
| `navtypes.create` | [Code.gs:32](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L32) | [Index.html:480](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L480) |
| `navtypes.rename` | [Code.gs:33](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L33) | [Index.html:479](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L479) |
| `navtypes.setActive` | [Code.gs:34](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L34) | [Index.html:478](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L478) |
| `assignments.list` | [Code.gs:35](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L35) | [Index.html:497](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L497) |
| `assignments.mine` | [Code.gs:36](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L36) | [Index.html:355](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L355) |
| `assignments.create` | [Code.gs:37](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L37) | [Index.html:492](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L492) |
| `assignments.update` | [Code.gs:38](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L38) | [Index.html:508](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L508) |
| `assignments.setActive` | [Code.gs:39](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L39) | [Index.html:501](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L501) |
| `record.edit` | [Code.gs:41](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L41) | [Index.html:450](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L450) |
| `record.cancel` | [Code.gs:42](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L42) | [Index.html:433](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L433) |
| `record.restore` | [Code.gs:43](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L43) | [Index.html:432](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L432) |
| `record.history` | [Code.gs:44](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L44) | [Index.html:437](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L437) |
| `correction.request` | [Code.gs:45](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L45) | [Index.html:450](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L450) |
| `correction.list` | [Code.gs:46](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L46) | [Index.html:466](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L466), [Index.html:697](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L697) |
| `correction.review` | [Code.gs:47](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L47) | [Index.html:473](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L473) |
| `settings.list` | [Code.gs:49](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L49) | [Index.html:802](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L802) |
| `settings.set` | [Code.gs:50](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L50) | [Index.html:802](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L802) |
| `fitness.types` | [Code.gs:51](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L51) | [Index.html:739](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L739), [Index.html:839](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L839) |
| `fitness.typeCreate` | [Code.gs:52](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L52) | Trace required |
| `fitness.typeWeights` | [Code.gs:53](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L53) | Trace required |
| `fitness.typeActive` | [Code.gs:54](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L54) | Trace required |
| `fitness.typeVariant` | [Code.gs:55](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L55) | Trace required |
| `fitness.draftSource` | [Code.gs:56](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L56) | Trace required |
| `fitness.versions` | [Code.gs:57](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L57) | [Index.html:837](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L837), [Index.html:839](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L839) |
| `fitness.importDraft` | [Code.gs:58](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L58) | [Index.html:836](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L836) |
| `fitness.editRow` | [Code.gs:59](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L59) | Trace required |
| `fitness.addTable` | [Code.gs:60](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L60) | Trace required |
| `fitness.approve` | [Code.gs:61](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L61) | [Index.html:848](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L848) |
| `fitness.create` | [Code.gs:62](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L62) | [Index.html:740](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L740) |
| `fitness.list` | [Code.gs:63](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L63) | [Index.html:741](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L741) |
| `fitness.summary` | [Code.gs:64](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L64) | Trace required |
| `fitness.completion` | [Code.gs:65](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L65) | [Index.html:690](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L690), [Index.html:732](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L732) |
| `fitness.quality` | [Code.gs:66](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L66) | [Index.html:844](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L844) |
| `fitness.recompute` | [Code.gs:67](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L67) | Trace required |
| `mk.create` | [Code.gs:68](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L68) | [Index.html:743](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L743) |
| `mk.list` | [Code.gs:69](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L69) | [Index.html:744](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L744) |
| `mk.summary` | [Code.gs:70](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L70) | Trace required |
| `exams.defs` | [Code.gs:71](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L71) | [Index.html:745](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L745) |
| `exams.defCreate` | [Code.gs:72](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L72) | [Index.html:746](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L746) |
| `exams.defPass` | [Code.gs:73](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L73) | Trace required |
| `exams.attempt` | [Code.gs:74](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L74) | [Index.html:747](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L747) |
| `exams.attempts` | [Code.gs:75](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L75) | [Index.html:748](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L748) |
| `exams.meetings` | [Code.gs:76](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L76) | [Index.html:749](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L749) |
| `exams.summary` | [Code.gs:77](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L77) | Trace required |
| `acttypes.list` | [Code.gs:78](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L78) | [Index.html:750](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L750) |
| `acttypes.create` | [Code.gs:79](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L79) | [Index.html:751](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L751) |
| `acttypes.rename` | [Code.gs:80](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L80) | Trace required |
| `acttypes.setActive` | [Code.gs:81](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L81) | Trace required |
| `attendance.create` | [Code.gs:82](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L82) | [Index.html:621](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L621) |
| `attendance.events` | [Code.gs:83](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L83) | [Index.html:752](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L752) |
| `attendance.roll` | [Code.gs:84](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L84) | [Index.html:630](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L630) |
| `attendance.summary` | [Code.gs:85](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L85) | Trace required |
| `marches.create` | [Code.gs:86](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L86) | [Index.html:754](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L754) |
| `marches.list` | [Code.gs:87](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L87) | [Index.html:755](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L755) |
| `marches.summary` | [Code.gs:88](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L88) | Trace required |
| `readiness.assess` | [Code.gs:89](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L89) | [Index.html:757](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L757) |
| `readiness.list` | [Code.gs:90](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L90) | [Index.html:758](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L758) |
| `readiness.summary` | [Code.gs:91](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L91) | Trace required |
| `readiness.notEntered` | [Code.gs:92](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L92) | [Index.html:688](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L688) |
| `events.create` | [Code.gs:93](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L93) | [Index.html:759](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L759) |
| `events.list` | [Code.gs:94](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L94) | [Index.html:760](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L760) |
| `qual.define` | [Code.gs:95](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L95) | [Index.html:761](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L761) |
| `qual.list` | [Code.gs:96](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L96) | [Index.html:762](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L762) |
| `qual.setActive` | [Code.gs:97](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L97) | Trace required |
| `qual.postpone` | [Code.gs:98](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L98) | Trace required |
| `qual.dueHistory` | [Code.gs:99](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L99) | Trace required |
| `qual.assignments` | [Code.gs:100](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L100) | [Index.html:762](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L762) |
| `qual.update` | [Code.gs:101](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L101) | Trace required |
| `qual.requestExclusion` | [Code.gs:102](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L102) | Trace required |
| `qual.reviewExclusion` | [Code.gs:103](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L103) | Trace required |
| `qual.summary` | [Code.gs:104](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L104) | Trace required |
| `assess.add` | [Code.gs:105](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L105) | Trace required |
| `assess.list` | [Code.gs:106](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L106) | Trace required |
| `notes.save` | [Code.gs:107](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L107) | [Index.html:766](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L766) |
| `notes.list` | [Code.gs:108](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L108) | Trace required |
| `followups.create` | [Code.gs:109](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L109) | [Index.html:767](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L767) |
| `followups.update` | [Code.gs:110](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L110) | Trace required |
| `followups.list` | [Code.gs:111](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L111) | [Index.html:768](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L768) |
| `favorites.toggle` | [Code.gs:112](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L112) | Trace required |
| `favorites.list` | [Code.gs:113](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L113) | [Index.html:769](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L769) |
| `snote.add` | [Code.gs:114](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L114) | Trace required |
| `snote.list` | [Code.gs:115](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L115) | Trace required |
| `snote.cancel` | [Code.gs:116](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L116) | Trace required |
| `alerts.refresh` | [Code.gs:117](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L117) | [Index.html:764](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L764) |
| `alerts.list` | [Code.gs:118](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L118) | [Index.html:692](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L692), [Index.html:763](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L763) |
| `alerts.handle` | [Code.gs:119](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L119) | [Index.html:763](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L763) |
| `alerts.counts` | [Code.gs:120](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L120) | Trace required |
| `forms.generalLink` | [Code.gs:121](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L121) | [Index.html:197](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L197) |
| `forms.createLink` | [Code.gs:122](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L122) | [Index.html:770](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L770) |
| `forms.list` | [Code.gs:123](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L123) | [Index.html:696](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L696), [Index.html:778](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L778) |
| `forms.review` | [Code.gs:124](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L124) | [Index.html:778](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L778) |
| `dash.home` | [Code.gs:125](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L125) | [Index.html:709](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L709) |
| `dash.overview` | [Code.gs:126](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L126) | [Index.html:677](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L677), [Index.html:723](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L723) |
| `dash.groups` | [Code.gs:127](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L127) | [Index.html:720](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L720) |
| `dash.compareCourses` | [Code.gs:128](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L128) | [Index.html:715](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L715) |
| `dash.trends` | [Code.gs:129](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L129) | Trace required |
| `dash.strengthsGaps` | [Code.gs:130](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L130) | Trace required |
| `analytics.insights` | [Code.gs:131](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L131) | [Index.html:646](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L646) |
| `reports.build` | [Code.gs:132](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L132) | [Index.html:781](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L781) |
| `reports.preview` | [Code.gs:133](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L133) | [Index.html:657](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L657) |
| `reports.generate` | [Code.gs:134](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L134) | [Index.html:660](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L660), [Index.html:782](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L782), [Index.html:783](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L783) |
| `reports.fullExport` | [Code.gs:135](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L135) | [Index.html:784](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L784) |
| `reports.download` | [Code.gs:136](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L136) | Trace required |
| `reports.jobs` | [Code.gs:137](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L137) | [Index.html:785](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L785) |
| `import.start` | [Code.gs:138](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L138) | [Index.html:789](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L789) |
| `import.preview` | [Code.gs:139](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L139) | Trace required |
| `import.decide` | [Code.gs:140](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L140) | Trace required |
| `import.commit` | [Code.gs:141](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L141) | [Index.html:791](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L791) |
| `import.cancel` | [Code.gs:142](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L142) | [Index.html:791](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L791) |
| `import.jobs` | [Code.gs:143](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L143) | [Index.html:791](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L791) |
| `docs.upload` | [Code.gs:144](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L144) | [Index.html:792](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L792) |
| `docs.list` | [Code.gs:145](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L145) | [Index.html:793](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L793) |
| `docs.download` | [Code.gs:146](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L146) | [Index.html:793](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L793) |
| `docs.requestLink` | [Code.gs:147](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L147) | Trace required |
| `docs.reviewLink` | [Code.gs:148](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L148) | [Index.html:794](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L794) |
| `docs.pendingLinks` | [Code.gs:149](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L149) | [Index.html:794](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L794) |
| `docs.attachEvidence` | [Code.gs:150](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L150) | Trace required |
| `docs.evidence` | [Code.gs:151](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L151) | Trace required |
| `ocr.start` | [Code.gs:152](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L152) | [Index.html:796](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L796) |
| `ocr.rows` | [Code.gs:153](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L153) | [Index.html:851](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L851) |
| `ocr.editRow` | [Code.gs:154](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L154) | Trace required |
| `ocr.approveRow` | [Code.gs:155](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L155) | [Index.html:851](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L851) |
| `ocr.rejectRow` | [Code.gs:156](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L156) | [Index.html:851](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L851) |
| `ai.ask` | [Code.gs:157](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L157) | [Index.html:798](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L798) |
| `ai.draft` | [Code.gs:158](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L158) | [Index.html:799](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L799) |
| `ai.drafts` | [Code.gs:159](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L159) | [Index.html:800](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L800) |
| `ai.reviewDraft` | [Code.gs:160](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L160) | [Index.html:800](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L800) |
| `backup.create` | [Code.gs:161](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L161) | [Index.html:807](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L807) |
| `backup.list` | [Code.gs:162](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L162) | [Index.html:808](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L808) |
| `backup.verify` | [Code.gs:163](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L163) | [Index.html:808](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L808) |
| `backup.plan` | [Code.gs:164](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L164) | [Index.html:819](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L819) |
| `backup.restore` | [Code.gs:165](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L165) | [Index.html:825](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L825) |
| `backup.recover` | [Code.gs:166](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L166) | [Index.html:815](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L815) |
| `backup.prune` | [Code.gs:169](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L169) | Trace required |
| `preflight.run` | [Code.gs:167](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L167) | [Index.html:829](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L829) |
| `preflight.last` | [Code.gs:168](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L168) | [Index.html:830](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L830) |
| `migration.run` | [Code.gs:170](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L170) | Trace required |
| `meetings.list` | [Code.gs:172](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L172) | [Index.html:936](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L936), [Index.html:1013](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L1013) |
| `meetings.get` | [Code.gs:173](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L173) | [Index.html:916](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L916), [Index.html:940](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L940) |
| `meetings.options` | [Code.gs:174](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L174) | [Index.html:910](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L910) |
| `meetings.save` | [Code.gs:175](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L175) | [Index.html:996](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L996) |
| `meetings.integrity` | [Code.gs:180](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L180) | [Index.html:924](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L924) |
| `meetings.auditRepair` | [Code.gs:181](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L181) | [Index.html:930](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L930) |
| `tasks.list` | [Code.gs:176](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L176) | [Index.html:1025](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L1025) |
| `tasks.get` | [Code.gs:177](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L177) | [Index.html:1042](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L1042) |
| `tasks.setStatus` | [Code.gs:178](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L178) | [Index.html:1054](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L1054) |
| `tasks.indicators` | [Code.gs:179](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L179) | [Index.html:911](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L911) |
| `audit.list` | [Code.gs:182](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L182) | [Index.html:809](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Index.html#L809) |

## Entry points outside the inventory

| Entry point | Source | Use |
|---|---|---|
| `doGet` | [Code.gs:185](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L185) | Routes authenticated UI and token form |
| `whoAmI` | [Code.gs:225](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L225) | Loads signed-in context |
| `formOpen` | [Code.gs:222](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L222) | Opens the one-time trainee form |
| `formSubmit` | [Code.gs:223](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L223) | Submits the one-time trainee form |
| `runDailyJobNow` | [Code.gs:219](https://github.com/maslul-2027/maslul-2027/blob/25b2e84/src/Code.gs#L219) | Administrator maintenance |

Private Google TEST setup and fixture helpers require reconciliation against the authorized TEST source.
