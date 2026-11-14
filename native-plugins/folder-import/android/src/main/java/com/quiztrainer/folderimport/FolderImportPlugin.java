package com.quiztrainer.folderimport;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * FolderImportPlugin: pickFolder(options) - ACTION_OPEN_DOCUMENT_TREE 调起系统文件夹
 * 选择器，递归读取其中的题库文本（.md / .markdown / .txt），返回 [{name, path, text}]。
 * Web 端由 FolderImportWeb（webkitdirectory input）兜底。
 *
 * 约束（与分享导入 readFileText 的口径一致）：
 *   - 单文件 > 2MB 跳过（skipped 计数），避免大文本撑爆 JS 堆；
 *   - 文件数上限 maxFiles（默认 200，硬上限 1000），超出置 truncated；
 *   - 目录递归深度上限 8，防止异常目录树失控。
 */
@CapacitorPlugin(name = "FolderImport")
public class FolderImportPlugin extends Plugin {

    private static final int MAX_DEPTH = 8;
    private static final long MAX_FILE_BYTES = 2L * 1024 * 1024;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(call, intent, "pickFolderResult");
        } catch (Exception e) {
            call.reject("无法打开系统文件夹选择器: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null || result.getData().getData() == null) {
            ret.put("success", false);
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }
        Uri treeUri = result.getData().getData();
        int maxFiles = call.getInt("maxFiles", 200);
        if (maxFiles <= 0 || maxFiles > 1000) maxFiles = 200;
        final int limit = maxFiles;
        /* @ActivityCallback 在主线程回调：递归遍历 + 读文件是耗时 IO，放后台线程，
           避免阻塞 UI（PluginCall.resolve 线程安全，内部会投递回 WebView） */
        new Thread(() -> {
            try {
                JSObject out = collectTree(treeUri, limit);
                out.put("success", true);
                call.resolve(out);
            } catch (Exception e) {
                call.reject("读取文件夹失败: " + e.getMessage(), e);
            }
        }, "folder-import").start();
    }

    private JSObject collectTree(Uri treeUri, int maxFiles) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri rootDocUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootDocId);
        JSArray files = new JSArray();
        int[] skipped = { 0 };
        boolean[] truncated = { false };
        walk(cr, treeUri, rootDocId, "", files, skipped, truncated, maxFiles, 0);
        JSObject ret = new JSObject();
        ret.put("folderName", displayName(cr, rootDocUri));
        ret.put("files", files);
        ret.put("skipped", skipped[0]);
        ret.put("truncated", truncated[0]);
        return ret;
    }

    /** 深度优先遍历目录树；relDir 为相对所选根目录的路径前缀（POSIX 分隔） */
    private void walk(ContentResolver cr, Uri treeUri, String parentDocId, String relDir,
                      JSArray out, int[] skipped, boolean[] truncated, int maxFiles, int depth) throws Exception {
        if (depth > MAX_DEPTH) return;
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId);
        String[] projection = {
                Document.COLUMN_DOCUMENT_ID,
                Document.COLUMN_DISPLAY_NAME,
                Document.COLUMN_MIME_TYPE,
                Document.COLUMN_SIZE,
        };
        /* sortOrder 传 null：个别 DocumentsProvider 不支持排序列；顺序由 JS 端统一排 */
        try (Cursor c = cr.query(childrenUri, projection, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                if (out.length() >= maxFiles) { truncated[0] = true; return; }
                String docId = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                long size = c.isNull(3) ? -1 : c.getLong(3);
                if (docId == null || name == null) continue;
                if (Document.MIME_TYPE_DIR.equals(mime)) {
                    walk(cr, treeUri, docId, relDir.isEmpty() ? name : relDir + "/" + name,
                            out, skipped, truncated, maxFiles, depth + 1);
                } else if (isBankName(name)) {
                    if (size > MAX_FILE_BYTES) { skipped[0]++; continue; }
                    String text = readText(cr, DocumentsContract.buildDocumentUriUsingTree(treeUri, docId));
                    if (text == null) { skipped[0]++; continue; }
                    JSObject f = new JSObject();
                    f.put("name", name);
                    f.put("path", relDir.isEmpty() ? name : relDir + "/" + name);
                    f.put("text", text);
                    out.put(f);
                }
            }
        }
    }

    /** 读 UTF-8 文本；边读边卡 2MB 上限（部分 provider 的 COLUMN_SIZE 不可信） */
    private String readText(ContentResolver cr, Uri uri) {
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(chunk)) != -1) {
                total += n;
                if (total > MAX_FILE_BYTES) return null;
                buf.write(chunk, 0, n);
            }
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private String displayName(ContentResolver cr, Uri docUri) {
        try (Cursor c = cr.query(docUri, new String[]{ Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String name = c.getString(0);
                if (name != null && !name.isEmpty()) return name;
            }
        } catch (Exception ignored) {
            /* 个别 provider 不允许查根文档元信息：退回通用名 */
        }
        return "文件夹";
    }

    private static boolean isBankName(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt");
    }
}