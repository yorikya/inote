
package com.yourorg.sample;

import android.os.AsyncTask;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import android.os.Handler;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import java.net.*;
import java.io.*;
import java.util.*;
import java.io.File;

public class MainActivity extends AppCompatActivity {

    // Used to load the 'native-lib' library on application startup.
    static {
        System.loadLibrary("native-lib");
        System.loadLibrary("node");
    }

    //We just want one instance of node running in the background.
    public static boolean _startedNodeAlready=false;
    
    // File chooser support
    private ValueCallback<Uri[]> mFilePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1;
    private android.webkit.PermissionRequest mPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        final WebView webView = (WebView) findViewById(R.id.webview);
        
        // ============================================
        // CRITICAL: Enable DOM Storage for localStorage
        // ============================================
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);  // Enable localStorage
        webSettings.setDatabaseEnabled(true);     // Enable database storage
        
        // Additional settings for better WebView performance
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        
        // Enable debugging (optional, useful for development)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d("WebView", "Page loaded: " + url);
            }
            
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e("WebView", "Error loading page: " + description);
            }
        });
        
        // ============================================
        // CRITICAL: Implement File Chooser for Image Upload
        // ============================================
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                Log.d("WebView Console", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }

            // For Android 5.0+ (API 21+)
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                            FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "Select Images"), FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    mFilePathCallback = null;
                    Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                MainActivity.this.mPermissionRequest = request;
                final String[] requestedResources = request.getResources();
                for (String r : requestedResources) {
                    if (r.equals(android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, 200);
                            } else {
                                request.grant(request.getResources());
                            }
                        } else {
                            request.grant(request.getResources());
                        }
                        break;
                    }
                }
            }
        });

        // Wait for 2 seconds before loading the URL to ensure Node.js server is running
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d("MainActivity", "Loading WebView URL: http://127.0.0.1:30000");
                webView.loadUrl("http://127.0.0.1:30000");
            }
        }, 2000);

        if (!_startedNodeAlready) {
            _startedNodeAlready = true;
            new Thread(new Runnable() {
                @Override
                public void run() {
                    // The path where we expect the node project to be at runtime.
                    String nodeDir = getApplicationContext().getFilesDir().getAbsolutePath()+"/nodejs-project";
                    String wwwDir = getApplicationContext().getFilesDir().getAbsolutePath()+"/www";
                    
                    Log.d("MainActivity", "Node directory: " + nodeDir);
                    Log.d("MainActivity", "WWW directory: " + wwwDir);
                    
                    if (wasAPKUpdated()) {
                        Log.d("MainActivity", "APK was updated, copying assets...");

                        // Backup user data before deleting directories
                        String notesBackupPath = backupUserData(nodeDir);

                        // Recursively delete any existing nodejs-project and www folders.
                        File nodeDirReference = new File(nodeDir);
                        if (nodeDirReference.exists()) {
                            deleteFolderRecursively(new File(nodeDir));
                        }
                        File wwwDirReference = new File(wwwDir);
                        if (wwwDirReference.exists()) {
                            deleteFolderRecursively(new File(wwwDir));
                        }

                        // Copy the node project from assets into the application's data path.
                        copyAssetFolder(getApplicationContext().getAssets(), "nodejs-project", nodeDir);
                        copyAssetFolder(getApplicationContext().getAssets(), "www", wwwDir);

                        // Restore user data after copying new assets
                        if (notesBackupPath != null) {
                            restoreUserData(nodeDir, notesBackupPath);
                        }

                        saveLastUpdateTime();
                        Log.d("MainActivity", "Assets copied successfully");
                    } else {
                        Log.d("MainActivity", "APK not updated, using existing assets");
                    }
                    
                    Log.d("MainActivity", "Starting Node.js with min.js");
                    startNodeWithArguments(new String[]{"node",
                            nodeDir+"/min.js"
                    });
                }
            }).start();
        }
    }
    
    // ============================================
    // Handle File Chooser Result
    // ============================================
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        Log.d("MainActivity", "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback == null) {
                Log.e("MainActivity", "mFilePathCallback is null");
                return;
            }
            
            Uri[] results = null;
            
            if (resultCode == RESULT_OK) {
                if (data != null) {
                    String dataString = data.getDataString();
                    
                    // Handle multiple file selection
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                            Log.d("MainActivity", "Selected file " + i + ": " + results[i].toString());
                        }
                    }
                    // Handle single file selection
                    else if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                        Log.d("MainActivity", "Selected single file: " + dataString);
                    }
                }
            } else {
                Log.d("MainActivity", "File chooser cancelled");
            }
            
            mFilePathCallback.onReceiveValue(results);
            mFilePathCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 200) {
            if (mPermissionRequest != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    mPermissionRequest.grant(mPermissionRequest.getResources());
                } else {
                    mPermissionRequest.deny();
                }
                mPermissionRequest = null;
            }
        }
    }

    /**
     * A native method that is implemented by the 'native-lib' native library,
     * which is packaged with this application.
     */
    public native Integer startNodeWithArguments(String[] arguments);

    private boolean wasAPKUpdated() {
        SharedPreferences prefs = getApplicationContext().getSharedPreferences("NODEJS_MOBILE_PREFS", Context.MODE_PRIVATE);
        long previousLastUpdateTime = prefs.getLong("NODEJS_MOBILE_APK_LastUpdateTime", 0);
        long lastUpdateTime = 1;
        try {
            PackageInfo packageInfo = getApplicationContext().getPackageManager().getPackageInfo(getApplicationContext().getPackageName(), 0);
            lastUpdateTime = packageInfo.lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
        Log.d("MainActivity", "Previous update time: " + previousLastUpdateTime + ", Current: " + lastUpdateTime);
        return (lastUpdateTime != previousLastUpdateTime);
    }

    private void saveLastUpdateTime() {
        long lastUpdateTime = 1;
        try {
            PackageInfo packageInfo = getApplicationContext().getPackageManager().getPackageInfo(getApplicationContext().getPackageName(), 0);
            lastUpdateTime = packageInfo.lastUpdateTime;
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
        SharedPreferences prefs = getApplicationContext().getSharedPreferences("NODEJS_MOBILE_PREFS", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putLong("NODEJS_MOBILE_APK_LastUpdateTime", lastUpdateTime);
        editor.commit();
        Log.d("MainActivity", "Saved update time: " + lastUpdateTime);
    }

    private static boolean deleteFolderRecursively(File file) {
        try {
            boolean res=true;
            for (File childFile : file.listFiles()) {
                if (childFile.isDirectory()) {
                    res &= deleteFolderRecursively(childFile);
                } else {
                    res &= childFile.delete();
                }
            }
            res &= file.delete();
            return res;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private static boolean copyAssetFolder(AssetManager assetManager, String fromAssetPath, String toPath) {
        try {
            String[] files = assetManager.list(fromAssetPath);
            boolean res = true;

            if (files.length==0) {
                //If it's a file, it won't have any assets "inside" it.
                res &= copyAsset(assetManager,
                        fromAssetPath,
                        toPath);
            } else {
                new File(toPath).mkdirs();
                for (String file : files) {
                    Log.d("Copying asset folder", "From: " + fromAssetPath + "/" + file + " To: " + toPath + "/" + file);
                    res &= copyAssetFolder(assetManager,
                            fromAssetPath + "/" + file,
                            toPath + "/" + file);
                }
            }
            return res;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private static boolean copyAsset(AssetManager assetManager, String fromAssetPath, String toPath) {
        InputStream in = null;
        OutputStream out = null;
        try {
            Log.d("Copying asset", "From: " + fromAssetPath + " To: " + toPath);
            in = assetManager.open(fromAssetPath);
            new File(toPath).createNewFile();
            out = new FileOutputStream(toPath);
            copyFile(in, out);
            in.close();
            in = null;
            out.flush();
            out.close();
            out = null;
            return true;
        } catch(Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private static void copyFile(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[1024];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
    }

    /**
     * Backs up user data before updating the app
     * @param nodeDir Path to the nodejs-project directory
     * @return Path to the backup file, or null if backup failed
     */
    private String backupUserData(String nodeDir) {
        try {
            // Check if notes.json exists
            File notesFile = new File(nodeDir, "notes.json");
            if (!notesFile.exists()) {
                Log.d("MainActivity", "No notes.json file found, nothing to backup");
                return null;
            }

            // Create backup directory in app's external storage
            File backupDir = new File(getApplicationContext().getExternalFilesDir(null), "backup");
            if (!backupDir.exists()) {
                backupDir.mkdirs();
            }

            // Create backup file with timestamp
            String timestamp = String.valueOf(System.currentTimeMillis());
            File backupFile = new File(backupDir, "notes_backup_" + timestamp + ".json");

            // Copy notes.json to backup location
            copyFile(new FileInputStream(notesFile), new FileOutputStream(backupFile));

            // Also backup the images directory if it exists
            File imagesDir = new File(nodeDir, "images");
            if (imagesDir.exists() && imagesDir.isDirectory()) {
                File imagesBackupDir = new File(backupDir, "images_backup_" + timestamp);
                copyFolder(imagesDir, imagesBackupDir);
                Log.d("MainActivity", "Images directory backed up to: " + imagesBackupDir.getAbsolutePath());
            }

            Log.d("MainActivity", "Notes backed up to: " + backupFile.getAbsolutePath());
            return backupFile.getAbsolutePath();
        } catch (Exception e) {
            Log.e("MainActivity", "Error backing up user data: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Restores user data after updating the app
     * @param nodeDir Path to the nodejs-project directory
     * @param notesBackupPath Path to the backup file
     */
    private void restoreUserData(String nodeDir, String notesBackupPath) {
        try {
            // Restore notes.json from backup
            File backupFile = new File(notesBackupPath);
            if (backupFile.exists()) {
                File notesFile = new File(nodeDir, "notes.json");
                copyFile(new FileInputStream(backupFile), new FileOutputStream(notesFile));
                Log.d("MainActivity", "Notes restored from backup");

                // Try to restore images directory if it exists
                String backupFileName = backupFile.getName();
                String timestamp = backupFileName.substring(backupFileName.indexOf("_") + 1, backupFileName.lastIndexOf("."));
                File imagesBackupDir = new File(getApplicationContext().getExternalFilesDir(null), "backup/images_backup_" + timestamp);
                File imagesDir = new File(nodeDir, "images");

                if (imagesBackupDir.exists() && imagesBackupDir.isDirectory()) {
                    if (!imagesDir.exists()) {
                        imagesDir.mkdirs();
                    }
                    copyFolder(imagesBackupDir, imagesDir);
                    Log.d("MainActivity", "Images directory restored from backup");
                }

                // Clean up old backups (keep only the most recent 3)
                cleanupOldBackups();
            } else {
                Log.e("MainActivity", "Backup file not found: " + notesBackupPath);
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error restoring user data: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Copies a folder and its contents recursively
     */
    private void copyFolder(File source, File destination) {
        try {
            if (!destination.exists()) {
                destination.mkdirs();
            }

            File[] files = source.listFiles();
            if (files != null) {
                for (File file : files) {
                    File destFile = new File(destination, file.getName());
                    if (file.isDirectory()) {
                        copyFolder(file, destFile);
                    } else {
                        copyFile(new FileInputStream(file), new FileOutputStream(destFile));
                    }
                }
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error copying folder: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Cleans up old backup files, keeping only the most recent 3
     */
    private void cleanupOldBackups() {
        try {
            File backupDir = new File(getApplicationContext().getExternalFilesDir(null), "backup");
            if (backupDir.exists() && backupDir.isDirectory()) {
                File[] backupFiles = backupDir.listFiles(new FilenameFilter() {
                    @Override
                    public boolean accept(File dir, String name) {
                        return name.startsWith("notes_backup_") && name.endsWith(".json");
                    }
                });

                if (backupFiles != null && backupFiles.length > 3) {
                    // Sort by modification time (oldest first)
                    Arrays.sort(backupFiles, new Comparator<File>() {
                        @Override
                        public int compare(File f1, File f2) {
                            return Long.compare(f1.lastModified(), f2.lastModified());
                        }
                    });

                    // Delete the oldest files, keeping only the 3 most recent
                    for (int i = 0; i < backupFiles.length - 3; i++) {
                        if (backupFiles[i].delete()) {
                            Log.d("MainActivity", "Deleted old backup: " + backupFiles[i].getName());

                            // Also delete the corresponding images backup if it exists
                            String backupName = backupFiles[i].getName();
                            String timestamp = backupName.substring(backupName.indexOf("_") + 1, backupName.lastIndexOf("."));
                            File imagesBackupDir = new File(backupDir, "images_backup_" + timestamp);
                            if (imagesBackupDir.exists()) {
                                deleteFolderRecursively(imagesBackupDir);
                                Log.d("MainActivity", "Deleted old images backup: " + imagesBackupDir.getName());
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error cleaning up old backups: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
