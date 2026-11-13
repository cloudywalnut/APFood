package my.conceptsquad.apfood;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Theme colors: #3b2a1e espresso status bar / #fffefa ivory navigation bar
        getWindow().setStatusBarColor(android.graphics.Color.parseColor("#3b2a1e"));
        getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#fffefa"));

        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false); // Light text/icons on dark espresso
            insetsController.setAppearanceLightNavigationBars(true); // Dark buttons/icons on ivory
        }

        // Configure persistent cookies, DOM storage and database storage across app sessions
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            cookieManager.setAcceptThirdPartyCookies(webView, true);
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
        }

        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        String scheme = uri.getScheme();
        String host = uri.getHost();

        String targetUrl = null;
        if ("https".equalsIgnoreCase(scheme) && "apfoods.vercel.app".equalsIgnoreCase(host)) {
            targetUrl = uri.toString();
        } else if ("apfood".equalsIgnoreCase(scheme) || "my.conceptsquad.apfood".equalsIgnoreCase(scheme)) {
            String pathAndQuery = uri.getPath();
            if (pathAndQuery == null || pathAndQuery.isEmpty()) {
                pathAndQuery = "/app";
            }
            if (uri.getQuery() != null && !uri.getQuery().isEmpty()) {
                pathAndQuery += "?" + uri.getQuery();
            }
            targetUrl = "https://apfoods.vercel.app" + pathAndQuery;
        }

        if (targetUrl != null && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().loadUrl(targetUrl);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        CookieManager.getInstance().flush();
    }
}
