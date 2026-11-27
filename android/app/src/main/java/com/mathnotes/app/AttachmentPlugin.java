package com.mathnotes.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "Attachment")
public class AttachmentPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        try {
            String uri = call.getString("uri", "");
            if (!uri.startsWith("file://")) throw new SecurityException("Only local exported attachments are allowed");
            File file = new File(Uri.parse(uri).getPath()).getCanonicalFile();
            File root = new File(getContext().getCacheDir(), "exports").getCanonicalFile();
            if (!file.getPath().startsWith(root.getPath() + File.separator) || !file.isFile()) {
                throw new SecurityException("Attachment must be inside the export cache");
            }
            Uri content = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(content, call.getString("mime", "application/octet-stream"));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(android.content.ClipData.newRawUri("attachment", content));
            getActivity().startActivity(Intent.createChooser(intent, "选择附件阅读器"));
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("未安装可打开此文件的阅读器，请先安装PDF或相应文件阅读器", e);
        } catch (Exception e) {
            call.reject("打开附件失败：" + e.getMessage(), e);
        }
    }
}
