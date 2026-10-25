package br.com.lextecnologias.messenger;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import java.util.function.Consumer;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LexNativePlugin.class);
        super.onCreate(savedInstanceState);
        WebView wv = getBridge().getWebView();
        // Sons de aviso tocam sem precisar de um toque na tela antes.
        wv.getSettings().setMediaPlaybackRequiresUserGesture(false);
        // A página do app continua com prioridade mesmo fora da tela (para receber mensagens).
        wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        LexNativePlugin.opened(getIntent().getStringExtra(LexNotifier.EXTRA_CHAT));
    }

    // ---------- Avisar a outra pessoa sobre print e gravação de tela ----------
    private Activity.ScreenCaptureCallback shotCallback;
    private Consumer<Integer> recordingCallback;

    @Override
    public void onStart() {
        super.onStart();
        if (Build.VERSION.SDK_INT >= 34) {
            shotCallback = () -> LexNativePlugin.capture("screenshot");
            registerScreenCaptureCallback(getMainExecutor(), shotCallback);
        }
        if (Build.VERSION.SDK_INT >= 35) {
            recordingCallback = state ->
                    LexNativePlugin.capture(state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE ? "recording" : "recording-stop");
            int state = getWindowManager().addScreenRecordingCallback(getMainExecutor(), recordingCallback);
            if (state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) LexNativePlugin.capture("recording");
        }
    }

    @Override
    public void onStop() {
        if (Build.VERSION.SDK_INT >= 34 && shotCallback != null) unregisterScreenCaptureCallback(shotCallback);
        if (Build.VERSION.SDK_INT >= 35 && recordingCallback != null) getWindowManager().removeScreenRecordingCallback(recordingCallback);
        super.onStop();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        LexNativePlugin.opened(intent.getStringExtra(LexNotifier.EXTRA_CHAT));
    }
}
