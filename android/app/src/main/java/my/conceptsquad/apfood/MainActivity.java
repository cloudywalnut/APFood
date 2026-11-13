package my.conceptsquad.apfood;

import android.os.Bundle;
import android.webkit.CookieManager;
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

        // Enable cookies and third-party cookies for Supabase Auth & Realtime across origins
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (getBridge() != null && getBridge().getWebView() != null) {
            cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        }
    }
}
