# 十厘米里几针（knit-gauge）

样片织出来和图解的密度对不上时，把图解里每一片的起针、结束针、行数、加减针节奏按样片密度改过来：起针按花样倍数取整，结束针对齐每次加减针数，加减针在新行数里均分；算出改完后的宽高差，以及毛线（称重法 / 米数法）要几团。

- 体验：https://xululu0401.github.io/knit-gauge/
- 结构：index.html（由 template.html 复制）+ core.js（纯计算）+ ui.js（界面）
- 测试：node --test tests/core.test.cjs
- 默认场景为虚构示例；不判断针号与手感。
