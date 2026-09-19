# Kaggle 每日竞赛日报

日报由官方 Kaggle CLI 在 GitHub Actions 中抓取公开的 general 竞赛，并公开写入 `data/kaggle-active.json`。网站每次打开 Kaggle 板块通过 GitHub 公共 API 读取最新文件（因为 Actions 的 GITHUB_TOKEN 提交不会触发 Pages 重新部署）；Kaggle 凭证不进入网站代码，也不进入个人成长数据仓库。

## 首次启用

1. 登录 [Kaggle API 设置](https://www.kaggle.com/settings/api)，在 API 区域点击 **Generate New Token**，复制令牌。
2. 打开此仓库的 [Actions Secrets](https://github.com/Shaun050427/personal-growth-app/settings/secrets/actions)，点击 **New repository secret**，名称填写 `KAGGLE_API_TOKEN`，值填写刚才的 Kaggle Token。不要把令牌发到聊天里。
3. 打开 [Daily Kaggle competition report](https://github.com/Shaun050427/personal-growth-app/actions/workflows/kaggle-daily.yml)，点击 **Run workflow**，选择 `main` 并运行。成功后网站会显示日报。

每天约 **北京时间 09:15** 自动运行。GitHub Actions 的定时任务可能延迟，网站会显示实际更新时间。如果日报过期，页面会提示且不展示已过截止时间的比赛。更新失败时保留上一份成功日报，便于排查。

## 推荐指数

指数只依据 Kaggle 列表提供的**标题和副标题关键词**匹配四个方向：光芯片 40 分、图像生成/复原 32 分、光学 24 分、AI 算法 20 分；基础 10 分，组合匹配额外加分，最高 100 分。它衡量方向相关性，不衡量获奖难度、数据质量或研究价值。请点击官方链接确认参赛条件和准确规则。
