package fr.jlegac.pasapas.widget;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
public class MainActivity extends Activity {
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  String route = getIntent().getStringExtra("route");
  if (!"habits".equals(route) && !"week".equals(route)) route="home";
  try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://jlegac.github.io/onestepafteranother/#"+route))); }
  catch (android.content.ActivityNotFoundException e) { Toast.makeText(this,"Installe un navigateur pour ouvrir Pas à Pas.",Toast.LENGTH_LONG).show(); }
  finish();
 }
}
