/*
    NativeShare Cordova plugin — Android 原生分享/保存
      shareText(title, text)                     → ACTION_SEND text/plain
      shareFile(title, fileName, content)        → ACTION_SEND + FileProvider（content://）
      saveFile(title, fileName, content)         → ACTION_CREATE_DOCUMENT（系统文档选择器）
    回调约定：成功 → success()；用户取消保存 → error("cancelled")；失败 → error(原因)。
 */
package com.quiztrainer.nativeshare;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class NativeShare extends CordovaPlugin {

    private static final int REQUEST_CREATE_DOCUMENT = 0x51A5;
    private static final String PROVIDER_AUTH_SUFFIX = ".nativeshare.fileprovider";
    private static final String CACHE_SUBDIR = "nativeshare";

    /* saveFile 的跨回调状态（onActivityResult 与 execute 之间的中转） */
    private CallbackContext saveCallback = null;
    private String saveContent = null;

    @Override
    public boolean execute(String action, CordovaArgs args, CallbackContext callbackContext) throws JSONException {
        if ("shareText".equals(action)) {
            this.shareText(args.getString(0), args.getString(1), callbackContext);
            return true;
        }
        if ("shareFile".equals(action)) {
            this.shareFile(args.getString(0), args.getString(1), args.getString(2), callbackContext);
            return true;
        }
        if ("saveFile".equals(action)) {
            this.saveFile(args.getString(0), args.getString(1), args.getString(2), callbackContext);
            return true;
        }
        return false;
    }

    /* ACTION_SEND：把文本内容写成 .json 缓存文件，经 FileProvider 分享（系统分享面板） */
    private void shareFile(String title, String fileName, String content, CallbackContext callbackContext) {
        try {
            File dir = new File(cordova.getActivity().getCacheDir(), CACHE_SUBDIR);
            if (!dir.exists() && !dir.mkdirs()) {
                callbackContext.error("shareFile failed: cannot create cache dir");
                return;
            }
            File file = new File(dir, fileName);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(content.getBytes("UTF-8"));
            }
            Uri uri = FileProvider.getUriForFile(
                    cordova.getActivity(),
                    cordova.getActivity().getPackageName() + PROVIDER_AUTH_SUFFIX,
                    file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/json");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            cordova.getActivity().startActivity(Intent.createChooser(send, title != null ? title : "分享"));
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error("shareFile failed: " + e.getMessage());
        }
    }

    /* ACTION_SEND：纯文本分享（降级方案，无需 FileProvider） */
    private void shareText(String title, String text, CallbackContext callbackContext) {
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, text);
            cordova.getActivity().startActivity(Intent.createChooser(send, title != null ? title : "分享"));
            callbackContext.success();
        } catch (Exception e) {
            callbackContext.error("shareText failed: " + e.getMessage());
        }
    }

    /* ACTION_CREATE_DOCUMENT：调起系统文档选择器，把 JSON 保存到用户选择的本地位置 */
    private void saveFile(String title, String fileName, String content, CallbackContext callbackContext) {
        try {
            this.saveCallback = callbackContext;
            this.saveContent = content;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, fileName);
            cordova.startActivityForResult(intent, REQUEST_CREATE_DOCUMENT);
        } catch (Exception e) {
            this.saveCallback = null;
            this.saveContent = null;
            callbackContext.error("saveFile failed: " + e.getMessage());
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_CREATE_DOCUMENT) return;
        CallbackContext ctx = this.saveCallback;
        String content = this.saveContent;
        this.saveCallback = null;
        this.saveContent = null;
        if (ctx == null) return;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            ctx.error("cancelled"); /* 用户在文档选择器中取消 */
            return;
        }
        try (OutputStream os = cordova.getActivity().getContentResolver().openOutputStream(data.getData())) {
            os.write(content.getBytes("UTF-8"));
            ctx.success();
        } catch (Exception e) {
            ctx.error("saveFile failed: " + e.getMessage());
        }
    }
}
