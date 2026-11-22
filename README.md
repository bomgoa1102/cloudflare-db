# Demo đăng nhập với Cloudflare D1

Một ứng dụng nhỏ minh họa luồng **trình duyệt → Cloudflare Worker → D1**. Người dùng có thể đăng ký, đăng nhập và đăng xuất. GitHub Actions tự chạy migration và triển khai Worker khi có thay đổi trên nhánh `main`.

## Thành phần

- `public/`: giao diện HTML, CSS và JavaScript thuần.
- `src/index.js`: API chạy trên Cloudflare Workers; mật khẩu được băm bằng PBKDF2 với salt riêng, phiên lưu trong D1 và cookie HttpOnly.
- `migrations/`: cấu trúc bảng `users` và `sessions`.
- `.github/workflows/deploy.yml`: triển khai từ GitHub Actions.

> Đây là demo học tập, chưa phù hợp để dùng cho sản phẩm thực tế: cần bổ sung giới hạn số lần đăng nhập, xác minh email, khôi phục mật khẩu, chính sách phiên và các biện pháp bảo mật khác trước khi sử dụng với dữ liệu thật.

## 1. Chuẩn bị

Cần tài khoản Cloudflare, Node.js 22 trở lên, npm và quyền quản trị repository GitHub. Kích hoạt Workers trong Cloudflare Dashboard nếu chưa từng sử dụng. Không đưa API token vào mã nguồn hoặc gửi token qua chat.

```bash
npm install
npx wrangler login
```

## 2. Tạo D1 database

```bash
npx wrangler d1 create login-demo-db
```

Sao chép `database_id` từ kết quả vào trường `database_id` trong `wrangler.jsonc`, thay `REPLACE_WITH_YOUR_DATABASE_ID`. Giữ tên database là `login-demo-db` để khớp với các lệnh và workflow. Nếu tên Worker đã được dùng trong tài khoản của bạn, đổi `name` trong cùng file.

## 3. Chạy trên máy

```bash
npm run db:local
npm run dev
```

Mở địa chỉ được Wrangler in ra (thường là http://localhost:8787), tạo tài khoản rồi đăng nhập lại. Dữ liệu local nằm trong `.wrangler/`, tách biệt hoàn toàn với database trên Cloudflare. Bạn có thể chạy local với ID placeholder; cần thay ID thật trước khi triển khai.

## 4. Kết nối GitHub để tự triển khai

1. Đưa mã nguồn và `wrangler.jsonc` đã điền database ID lên repository GitHub. Workflow mặc định chạy khi push lên nhánh **main**; nếu dùng nhánh khác, sửa `.github/workflows/deploy.yml` cho phù hợp.
2. Trong Cloudflare Dashboard, lấy **Account ID** và tạo API token có quyền trên đúng tài khoản: **Workers Scripts: Edit**, **D1: Edit** và **Account Settings: Read**. Giới hạn phạm vi token vào tài khoản cần dùng. Xem [hướng dẫn tạo API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).
3. Trong GitHub repository, vào **Settings → Secrets and variables → Actions → New repository secret** và tạo:
   - `CLOUDFLARE_API_TOKEN`: API token vừa tạo.
   - `CLOUDFLARE_ACCOUNT_ID`: Account ID của Cloudflare.
4. Push lên `main`, hoặc vào **Actions → Deploy to Cloudflare Workers → Run workflow**. Workflow áp dụng migration vào D1 thật trước khi deploy. Mở log bước deploy để lấy URL `workers.dev`.
5. Mở URL đó, tạo tài khoản mới và thử đăng xuất/đăng nhập. Dữ liệu local không tự đồng bộ lên D1 thật.

Có thể triển khai thủ công sau khi đã đăng nhập Wrangler và cấu hình database ID:

```bash
npm run db:remote
npm run deploy
```

Không commit token, file `.dev.vars`, `.env` hoặc thư mục `.wrangler`. Khi thay đổi schema, thêm migration mới thay vì sửa migration đã áp dụng. Tham khảo [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) và [Workers static assets](https://developers.cloudflare.com/workers/static-assets/).
