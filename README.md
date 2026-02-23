# 面试内容原子记忆站（含后台）

这个项目是面向 AI 自动化岗位面试的记忆网站，支持卡片学习 + 后台管理。

## 启动

```bash
cd "/Users/a1/Desktop/面试网站"
node server.js
```

打开：

- 学习页: `http://127.0.0.1:8080/index.html`
- 后台页: `http://127.0.0.1:8080/admin`
- Lecture 0 记忆卡片页: `http://127.0.0.1:8080/lecture0`
- Lecture 1 记忆卡片页: `http://127.0.0.1:8080/lecture1`
- Lecture 2 记忆卡片页: `http://127.0.0.1:8080/lecture2`
- Lecture 3 记忆卡片页: `http://127.0.0.1:8080/lecture3`

## 你现在可以做什么

- 在学习页按分类学习、复习、测验。
- 在后台新增、编辑、删除卡片。
- 保存后学习页刷新即可看到新内容。

## 卡片字段

每张卡片包含：

- `id`
- `term`
- `category`
- `core`
- `boundary`
- `signal`
- `action`
- `aliases`

学习页原子点固定为 5 条：

- 定义
- 边界
- 识别信号
- 落地动作
- 自测问题

已移除“面试提醒”原子点。

## 数据文件

- 卡片数据：`/Users/a1/Desktop/面试网站/data/cards.json`
- Lecture 0 卡片数据：`/Users/a1/Desktop/面试网站/data/lecture0-cards.json`
- Lecture 1 卡片数据：`/Users/a1/Desktop/面试网站/data/lecture1-cards.json`
- Lecture 2 卡片数据：`/Users/a1/Desktop/面试网站/data/lecture2-cards.json`
- Lecture 3 卡片数据：`/Users/a1/Desktop/面试网站/data/lecture3-cards.json`
- API 路由：`GET/POST /api/cards`、`PUT/DELETE /api/cards/:id`
