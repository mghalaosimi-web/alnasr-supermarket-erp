package com.alnasr.mobile

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.content.SharedPreferences

class MainActivity : Activity() {
    private lateinit var preferences: SharedPreferences
    private var webView: WebView? = null
    private val navy = Color.rgb(15, 37, 55)
    private val gold = Color.rgb(197, 160, 89)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        preferences = getSharedPreferences("alnasr-client", MODE_PRIVATE)
        window.statusBarColor = navy
        window.navigationBarColor = navy
        window.decorView.systemUiVisibility = 0

        val saved = preferences.getString("server_url", null)
        if (saved != null && validateServerUrl(saved) != null) {
            openSystem(saved)
        } else {
            showPairingScreen()
        }
    }

    private fun validateServerUrl(raw: String): Uri? {
        return try {
            val uri = Uri.parse(raw.trim().trimEnd('/'))
            if (uri.scheme != "https" || uri.host != "alnasr.local" || uri.userInfo != null) {
                null
            } else {
                uri
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun showPairingScreen(message: String? = null) {
        webView?.destroy()
        webView = null

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(28, 32, 28, 32)
            setBackgroundColor(Color.WHITE)
        }

        val title = TextView(this).apply {
            text = "النصر"
            textSize = 34f
            setTextColor(navy)
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = "نظام إدارة السوبرماركت"
            textSize = 16f
            setTextColor(Color.DKGRAY)
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 28)
        }
        val instructions = TextView(this).apply {
            text = "تأكد من اتصال الهاتف بنفس شبكة الكمبيوتر، وثبّت شهادة الأمان المحلية قبل الاتصال."
            textSize = 14f
            setTextColor(Color.DKGRAY)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 18)
        }
        val address = EditText(this).apply {
            hint = "https://alnasr.local"
            setSingleLine(true)
            setText(preferences.getString("server_url", "https://alnasr.local"))
            setTextColor(navy)
            setHintTextColor(Color.GRAY)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        val connect = Button(this).apply {
            text = "الاتصال بالنظام"
            setTextColor(Color.WHITE)
            setBackgroundColor(navy)
            setOnClickListener {
                val value = address.text?.toString().orEmpty()
                val uri = validateServerUrl(value)
                if (uri == null) {
                    Toast.makeText(this@MainActivity, "العنوان الآمن المعتمد هو https://alnasr.local", Toast.LENGTH_LONG).show()
                } else {
                    val normalized = uri.toString().trimEnd('/')
                    preferences.edit().putString("server_url", normalized).apply()
                    openSystem(normalized)
                }
            }
        }
        val status = TextView(this).apply {
            text = message ?: "الاتصال محمي عبر HTTPS"
            textSize = 12f
            setTextColor(if (message == null) gold else Color.RED)
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 0)
        }

        root.addView(title, matchWrap())
        root.addView(subtitle, matchWrap())
        root.addView(instructions, matchWrap())
        root.addView(address, matchWrap())
        root.addView(connect, matchWrap().apply { topMargin = 16 })
        root.addView(status, matchWrap())
        setContentView(root)
    }

    private fun matchWrap(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

    private fun openSystem(url: String) {
        val uri = validateServerUrl(url)
        if (uri == null) {
            showPairingScreen("عنوان الخادم غير صالح")
            return
        }

        val view = WebView(this)
        webView = view
        view.setBackgroundColor(Color.WHITE)
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            safeBrowsingEnabled = true
            setSupportMultipleWindows(false)
        }
        android.webkit.CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(view, false)
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val target = request?.url ?: return false
                if (target.scheme == "https" && target.host == "alnasr.local") return false
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, target))
                    true
                } catch (_: Exception) {
                    true
                }
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                handler?.cancel()
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "تعذر التحقق من شهادة الخادم. لن يتم تجاوز تحذير الأمان.", Toast.LENGTH_LONG).show()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "تعذر الوصول إلى الكمبيوتر. تحقق من الشبكة والخادم.", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
        setContentView(view)
        view.loadUrl(uri.toString())
    }

    @Deprecated("Deprecated in Android API; retained for WebView back navigation")
    override fun onBackPressed() {
        val current = webView
        if (current != null && current.canGoBack()) {
            current.goBack()
        } else {
            showPairingScreen()
        }
    }

    override fun onDestroy() {
        webView?.apply {
            stopLoading()
            destroy()
        }
        webView = null
        super.onDestroy()
    }
}
