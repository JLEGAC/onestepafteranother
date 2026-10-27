package fr.jlegac.pasapas.widget;
import android.appwidget.AppWidgetProvider;
import android.appwidget.AppWidgetManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
public class QuickWidget extends AppWidgetProvider {
 @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
  for(int id:ids) {
   RemoteViews view=new RemoteViews(context.getPackageName(),R.layout.widget);
   int[] buttons={R.id.today,R.id.habits,R.id.week};
   String[] routes={"home","habits","week"};
   for(int i=0;i<buttons.length;i++) {
    Intent intent=new Intent(context,MainActivity.class).putExtra("route",routes[i]);
    intent.setData(Uri.parse("pasapas-widget://open/"+id+"/"+routes[i]));
    view.setOnClickPendingIntent(buttons[i],PendingIntent.getActivity(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
   }
   manager.updateAppWidget(id,view);
  }
 }
}
