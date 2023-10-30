# 1 概述

## 1.1 问题由来

- 最近在用 `BookxNote Pro` （类似 margin note）做笔记，很多网络教程 (tutorial) 没有提供 PDF 版本，如果看过的内容没有立刻应用，就容易遗忘，而对网页做笔记不太容易（虽然有插件），所以在研究怎样批量存成 PDF，并且可以有目录（书签/菜单），同时去除无用元素
- 发现 `puppeteer` 非常适合，之前不太了解 js，一直忽略了它，它配合 `puppeteer-cluster` 可以实现并行抓取

## 1.2 基本使用和测试

- 安装 nodejs、puppeteer、puppeteer-cluster
- 修改 `index.js`
	- 修改 `puppeteerOptions` 中的 `userDataDir` 路径，用于存放浏览器数据
	- 修改 `puppeteerOptions.args` 中的 `--proxy-server` 一行的代理设置，没有代理则去掉
- 运行 `node index.js` 会在当前目录生成 `test` 文件夹，抓取正常的话会生成 `1.1.1 Async iteration and generators.pdf`
- 修改 `index.js` 最后的， `await cluster('configs\\test.txt');` 注释掉，使用下面的 `await cluster('configs\\The Modern JavaScript Tutorial.txt');`，即可生成 PDF 在 `The Modern JavaScript Tutorial` 文件夹下，最后可选择用 PDF 编辑器（如福昕pdf编辑器） 合并 PDF为一个文件
- 如想了解对网络教程生成 PDF 的通用方法，或想生成 `The Modern JavaScript Tutorial` 的 PDF 书签更精细可以向下阅读

## 1.3 通用方法

- 通用的转换方法分为 4 步
	- 获取菜单，可手动填写，也可以通过辅助脚本 `make_menu.js` 生成。最终构造一个每行包含“下载 url”、“要保存的文件名”、“等级”（行首 tab 缩进个数表示当前文章在教程的等级）所组成的配置文件。已经写好的一些在 `configs` 文件夹下，可供参考
	- 使用 `index.js` 运行 `puppeteer` 根据前面的配置文件，将每个页面保存成单独的 PDF
		- 在运行前，一般需要修改配置文件，加入抓取前要运行的 JS 代码，代码的目的一般是操作 DOM 移除无用的元素，调用 click 展开折叠的内容，设置 CSS 样式等，相当于生成 PDF 前的预处理。这部分 JS 代码，在配置文件中以 `!`  开头。配置文件的详细格式可见 `configs` 下面的示例说明
	- 使用 PDF 编辑器（如福昕pdf编辑器），合并 PDF为一个文件
		- 在合并前，如有某个等级的内容缺少，需要生成占位的 PDF，如 [The Modern JavaScript Tutorial](https://javascript.info/) 教程就只有 2、3 级有对应页面，而 1 级没有对应页面，那么就需要生成 3 个 1 级 PDF，`1. The JavaScript language.pdf`、`2. Browser꞉ Document, Events, Interfaces.pdf`、`3. Additional articles.pdf`，将这 3 个 PDF 放入前面抓取保存 PDF 的文件夹中，一起进行合并
		- 在合并后，会发现所有菜单（书签）都是 1 级，这时要用 `FreePic2Pdf` 提取书签生成 `FreePic2Pdf_bkmk.txt`， 调用 `correctBkmk.js` 对菜单等级进行修正，再将修改后的 `FreePic2Pdf_bkmk_corrected.txt` 挂回到原来的 PDF 中
	- （可选）添加页面内部等级，如按以上步骤生成的 [The Modern JavaScript Tutorial](https://javascript.info/) 是 3 级菜单，但抓取时每个页面内部也是有标题的，页面内的标题可以构成第 4 级菜单
		- 用 `PDF补丁丁` 选择要作为 4 级的内容来自动生成书签，生成前勾选保留原有书签（即原来已经存在的前 3 级书签），保存改后的 PDF
		- 再用 `FreePic2Pdf` 提取改后的 PDF 书签生成 `FreePic2Pdf_bkmk.txt`，手动修正 `FreePic2Pdf_bkmk.txt` 中末尾 4 级书签的前几项 （`PDF补丁丁`生成的前几项的缩进是错的，要加 tab）
		- 最后调用 `sortBkmk.js`，将 4 级书签按照页码顺序拆入到之前生成的前 3 级书签中，生成 `FreePic2Pdf_bkmk_sorted.txt`
		- 将 `FreePic2Pdf_bkmk_sorted.txt` 挂回到原来的 PDF 中，至此，一个包含 4 级菜单（书签）的 PDF 制作完成
- 针对不同的网络教程转 PDF 时，多数流程可以复用，每次需要改变的是
	- 第 1 步中 `make_menu.js` 的 CSS selector 或选择手动构造配置文件也行
	- 第 2 步中用于生成 PDF 前的预处理 JS 代码
	- `index.js` 中，调整并发数目、延时、如有 iframe 则需要等待 frame 加载完，等少量修改
	- 如有某个等级的内容缺少，需要生成占位的 PDF

# 2 步骤详细说明

以下步骤以  [The Modern JavaScript Tutorial](https://javascript.info/) 为例进行说明

## 2.1 获取菜单，构造配置文件

- 在 devtools 的 sources 中新建 snippet，粘贴 `make_menu.js` 代码
- 首先通过 chrome devtools 观察网页结构，确定 `make_menu.js` 中 selectors 数组的内容
- selectors 是二维数组，第 1 维度表明不同的级数，比如这个网页有 3 级菜单，那么第 1 维就有 3 个元素
- 第 2 维度可有 2-4 个元素，依次如下
	- items_selector，选择这一级菜单集合的 selector，原理是 `这一级元素集合 = 上一级元素.querySelectorAll(items_selector)`
	- item_title，选择这一级菜单标题的 selector，原理是 `forEach 这一级元素集合 { 标题 = 其中某一元素.querySelector(item_title) }`
	- item_url 同 item_title，只不过有的等级没有对应的 url，只有标题时，则这一项不填
	- item_action，有的菜单需要点击后才会展开，才能获取到下一级菜单，如需点击则为 'click'，点击 item_url 后，再继续获取下一级菜单，不需要则不填

![](如何将网络教程%20(tutorial)%20转成%20PDF/img-1.png)

- 多次调试确定好 selectors 后，运行 make_menu 会打印获取到的菜单，右键 save 将其存为 log
- 使用带列块编辑的文本编辑器，如 notepad++，删除 log 前无用内容
- 将 log 文件改名成 xxx.txt 放入 configs 文件夹，xxx 一般是教程的名字
- 对于不复杂、内容不多的教程，可手动填写配置文件，格式见 configs 文件夹下的例子
	- **注意配置文件换行是 linux 文件格式** `\n` 作为换行符，不是 windows 格式
	![](如何将网络教程%20(tutorial)%20转成%20PDF/img-2.png)

## 2.2 设置 JS 代码，下载 PDF

- 修改 `index.js` 最后使用的配置文件为前面构造的，用 `node index.js` 测试
- 一般来说需要设置 JS 来将无用元素删除掉，这样生成的 PDF 更干净
- 比如不想包含页面最上面这个工具栏，通过 devtools 确定 class 后，使用 querySelector 删除掉
![](如何将网络教程%20(tutorial)%20转成%20PDF/img-3.png)

- 反复测试，确定好最终要执行的 JS，将其写入到配置文件中，JS 代码以 `!` 开头，注释以 `*` 开头。如 `The Modern JavaScript Tutorial` 的最终 JS 代码如下
- 最后用  `node index.js` 下载 PDF

![](如何将网络教程%20(tutorial)%20转成%20PDF/img-4.png)

## 2.3 完善 PDF

- 生成的 PDF 有可能某个等级的 PDF 缺失，比如 The Modern JavaScript Tutorial 就是第 1 级缺失，需要生成占位的 PDF，对于 The Modern JavaScript Tutorial 就是 3 个 PDF
	- 推荐编写 HTML 然后用 chrome 打开，按 A4 大小输出成 PDF
	![](如何将网络教程%20(tutorial)%20转成%20PDF/img-5.png)

- 将生成的 PDF 放入前面步骤存放抓取 PDF 的同一目录，使用 PDF 编辑器（如福昕pdf编辑器）合并成一个 PDF
- 生成的 PDF 目录等级都是 1 级，所以需要修正
	- 用 `FreePic2Pdf` 选 “从 PDF 取书签”，生成 `FreePic2Pdf_bkmk.txt`，拷贝到 `correctBkmk.js`  所在目录
	- 用 `correctBkmk.js` 修正  `FreePic2Pdf_bkmk.txt`
	- 将修正后的 `FreePic2Pdf_bkmk_corrected.txt` 粘贴到原 `FreePic2Pdf_bkmk.txt`
	- 用 `FreePic2Pdf` 选 “往 PDF 挂书签”，将改后书签挂回
	![](如何将网络教程%20(tutorial)%20转成%20PDF/img-6.png)

## 2.4 （可选）添加页面内部等级

- 如按以上步骤生成的 [The Modern JavaScript Tutorial](https://javascript.info/) 是 3 级菜单，但抓取时每个页面内部也是有标题的，页面内的标题可以构成第 4 级菜单
- 使用 `PDF 补丁丁`，在要作为 4 级标题的内容上右键，在生成书签时一定要勾选“保留原有书签”，最后保存 PDF

![](如何将网络教程%20(tutorial)%20转成%20PDF/img-7.png)

- 用 `FreePic2Pdf` 选 “从 PDF 取书签”，生成 `FreePic2Pdf_bkmk.txt`，操作方法参考前一步骤
- 手动修正 `FreePic2Pdf_bkmk.txt` 中末尾 4 级书签的前几项 ，`PDF补丁丁`生成的前几项的缩进是错的，要加 tab

![](如何将网络教程%20(tutorial)%20转成%20PDF/img-8.png)
- 将 `FreePic2Pdf_bkmk.txt`，拷贝到 `sortBkmk.js`  所在目录，将 4 级书签按照页码顺序拆入到之前生成的前 3 级书签中，生成 `FreePic2Pdf_bkmk_sorted.txt`
- 将修正后的 `FreePic2Pdf_bkmk_sorted.txt` 粘贴到原 `FreePic2Pdf_bkmk.txt`
- 用 `FreePic2Pdf` 选 “往 PDF 挂书签”，将改后书签挂回，操作方法参考前一步骤

# 3 最终效果

- 至此便成功生成了 `The Modern JavaScript Tutorial` 的具备 disqus 评论、4 级书签的 PDF 文件
	- 由于 `The Modern JavaScript Tutorial` 的 PDF 版本是收费的，所以**不提供最终的 PDF，请按教程自行下载**
- 用到的 `FreePic2Pdf` 和 `PDF 补丁丁` 在 `bin` 目录内，也可自行搜索最新版
- 可按照这个方法将其它网络教程 (tutorial) 转成 PDF

![](如何将网络教程%20(tutorial)%20转成%20PDF/img-9.png)