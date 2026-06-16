import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Image, Platform, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/features/auth/authStore';

function CustomHeader() {
  const user = useAuthStore((state) => state.user);
  
  return (
    <View className="flex-row justify-between items-center px-6 pt-14 pb-4 bg-white/80" style={StyleSheet.absoluteFill}>
      <View>
        <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-sm text-neutral-500">Good morning,</Text>
        <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-2xl text-neutral-900">{user?.displayName || 'User'}</Text>
      </View>
      <View className="w-12 h-12 rounded-full overflow-hidden bg-neutral-200">
        <Image 
          source={{ uri: user?.profilePictureUrl || 'https://api.dicebear.com/7.x/avataaars/png?seed=Felix' }} 
          className="w-full h-full"
        />
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <CustomHeader />,
        headerTransparent: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'web' ? 24 : 32,
          alignSelf: 'center',
          width: Platform.OS === 'web' ? 400 : '90%',
          height: 64,
          borderRadius: 32,
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000000',
          shadowOpacity: 0.1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 12,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>
        }}
      />
    </Tabs>
  );
}
