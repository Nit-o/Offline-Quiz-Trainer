package com.quiztrainer.savefile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * SaveFilePlugin: saveFile(options) - ACTION_CREATE_DOCUMENT picker for exporting FSRS backups.
 * Web fallback implemented by SaveFileWeb (browser download).
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String title = call.getString("title", "");
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        if (fileName == null || fileName.isEmpty()) {
            call.reject("fileName is required");
            return;
        }
        if (content == null) {
            call.reject("content is required");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeForName(fileName));
        intent.putExtra(Intent.EXTRA_TITLE, title != null && !title.isEmpty() ? title : fileName);

        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            call.reject("no uri returned from document picker");
            return;
        }
        Uri uri = data.getData();
        String content = call.getString("content");
        try {
            OutputStream os = getContext().getContentResolver().openOutputStream(uri, "w");
            if (os == null) {
                call.reject("cannot open output stream");
                return;
            }
            try {
                os.write(content.getBytes(StandardCharsets.UTF_8));
            } finally {
                os.close();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage(), e);
        }
    }

    private static String mimeForName(String fileName) {
        String lower = fileName.toLowerCase(java.util.Locale.ROOT);
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".md")) return "text/markdown";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        return "application/octet-stream";
    }
}