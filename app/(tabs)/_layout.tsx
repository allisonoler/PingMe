import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../lib/theme';
const icons:Record<string,string>={home:'◉',friends:'♧',create:'＋',settings:'☼'};
export default function TabLayout(){return <Tabs screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:colors.green,tabBarInactiveTintColor:colors.muted,tabBarStyle:{height:76,paddingTop:9,paddingBottom:11,borderTopColor:colors.line,backgroundColor:'#fff'},tabBarLabelStyle:{fontSize:11,fontWeight:'700'},tabBarIcon:({color})=><Text style={{fontSize:20,color}}>{icons[route.name]||'•'}</Text>})}><Tabs.Screen name="home" options={{title:'Pings'}}/><Tabs.Screen name="friends" options={{title:'Friends'}}/><Tabs.Screen name="create" options={{title:'New ping'}}/><Tabs.Screen name="settings" options={{title:'Settings'}}/></Tabs>;}
