import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateGroupMutation } from '../../src/features/groups/hooks/useGroupMutations';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

const GROUP_TYPES = [
  { id: 'TRIP', label: 'Trip', icon: '✈️' },
  { id: 'HOUSEHOLD', label: 'Household', icon: '🏠' },
  { id: 'TEAM', label: 'Team', icon: '🤝' },
  { id: 'EVENT', label: 'Event', icon: '🎉' },
  { id: 'PROJECT', label: 'Project', icon: '💼' },
  { id: 'CUSTOM', label: 'Custom', icon: '✨' }
];

export default function CreateGroupScreen() {
  const router = useRouter();
  const createGroupMutation = useCreateGroupMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [selectedType, setSelectedType] = useState('TRIP');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a group name');
      return;
    }

    try {
      await createGroupMutation.mutateAsync({
        name: name.trim(),
        type: selectedType,
        description: description.trim() || undefined,
        avatar: avatar.trim() || undefined,
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create group');
    }
  };

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
      {/* Header */}
      <View className="mb-8 mt-4">
        <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-3xl text-neutral-900 mb-2">Create Group</Text>
        <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-base text-neutral-500">Set up a new space for your shared expenses.</Text>
      </View>

      {/* Avatar Section */}
      <View className="items-center mb-8">
        <View className="w-28 h-28 rounded-3xl bg-white shadow-sm border border-neutral-200 items-center justify-center overflow-hidden mb-4">
          {avatar ? (
            <Image source={{ uri: avatar }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Text className="text-4xl">📸</Text>
          )}
        </View>
        <View className="w-full">
          <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-sm text-neutral-600 mb-2 ml-1">Avatar Image URL</Text>
          <TextInput
            className="w-full h-12 bg-white rounded-xl px-4 border border-neutral-200 shadow-sm text-neutral-900"
            style={{ fontFamily: 'Inter_400Regular' }}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor="#cbd5e1"
            value={avatar}
            onChangeText={setAvatar}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Group Type Chips */}
      <View className="mb-8">
        <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-lg text-neutral-900 mb-3 ml-1">Group Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {GROUP_TYPES.map((type) => {
            const isSelected = selectedType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setSelectedType(type.id)}
                className={`flex-row items-center px-4 py-3 rounded-2xl mr-3 shadow-sm border ${
                  isSelected ? 'bg-neutral-900 border-neutral-900' : 'bg-white border-neutral-200'
                }`}
              >
                <Text className="text-lg mr-2">{type.icon}</Text>
                <Text style={{ fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium' }} className={`${isSelected ? 'text-white' : 'text-neutral-700'}`}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Name Input */}
      <View className="mb-6">
        <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-sm text-neutral-600 mb-2 ml-1">Group Name <Text className="text-error">*</Text></Text>
        <TextInput
          className="w-full h-14 bg-white rounded-xl px-4 border border-neutral-200 shadow-sm text-neutral-900 text-base"
          style={{ fontFamily: 'Inter_500Medium' }}
          placeholder="e.g. Goa Trip 2026"
          placeholderTextColor="#cbd5e1"
          value={name}
          onChangeText={setName}
        />
      </View>

      {/* Description Input */}
      <View className="mb-10">
        <Text style={{ fontFamily: 'Inter_500Medium' }} className="text-sm text-neutral-600 mb-2 ml-1">Description (Optional)</Text>
        <TextInput
          className="w-full bg-white rounded-xl p-4 border border-neutral-200 shadow-sm text-neutral-900 text-base min-h-[100px]"
          style={{ fontFamily: 'Inter_400Regular' }}
          placeholder="What's this group about?"
          placeholderTextColor="#cbd5e1"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={handleCreate}
        disabled={createGroupMutation.isPending}
        className="w-full h-14 rounded-2xl bg-primary shadow-glow-primary justify-center items-center active:opacity-80"
      >
        {createGroupMutation.isPending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-white text-lg">Create Group</Text>
        )}
      </TouchableOpacity>
      
    </ScrollView>
  );
}
