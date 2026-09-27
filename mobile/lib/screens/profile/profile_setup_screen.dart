import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../constants/app_constants.dart';
import '../../models/user_model.dart';
import '../../models/intent_model.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gradient_button.dart';
import '../../widgets/glass_card.dart';
import '../main_shell.dart';

class ProfileSetupScreen extends StatefulWidget {
  final bool isInitialSetup;

  const ProfileSetupScreen({super.key, this.isInitialSetup = false});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _bioController;
  String? _selectedBranch;
  int? _selectedYear;
  Gender _selectedGender = Gender.male;
  InterestedIn _selectedInterestedIn = InterestedIn.everyone;
  IntentType _selectedIntent = IntentType.dating;

  final List<String> _existingPhotoUrls = [];
  final List<File> _newPhotoFiles = [];
  final List<String> _selectedInterests = [];
  final List<String> _selectedActivities = [];

  final ImagePicker _picker = ImagePicker();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _bioController = TextEditingController();

    final profile = context.read<AuthProvider>().myProfile;
    if (profile != null) {
      _nameController.text = profile.name;
      _bioController.text = profile.bio ?? '';
      _selectedBranch = profile.branch;
      _selectedYear = profile.year;
      _selectedGender = profile.gender;
      _selectedInterestedIn = profile.interestedIn;
      _selectedIntent = profile.activeIntent;
      _existingPhotoUrls.addAll(profile.photos);
      _selectedInterests.addAll(profile.interests);
      _selectedActivities.addAll(profile.activityTags);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  int get _totalPhotos => _existingPhotoUrls.length + _newPhotoFiles.length;

  Future<void> _pickPhoto() async {
    if (_totalPhotos >= AppConstants.maxPhotos) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 6 photos allowed.')),
      );
      return;
    }

    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );

      if (picked != null) {
        setState(() {
          _newPhotoFiles.add(File(picked.path));
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not pick photo: $e')),
        );
      }
    }
  }

  void _removeExistingPhoto(int index) {
    setState(() {
      _existingPhotoUrls.removeAt(index);
    });
  }

  void _removeNewPhoto(int index) {
    setState(() {
      _newPhotoFiles.removeAt(index);
    });
  }

  void _toggleInterest(String tag) {
    setState(() {
      if (_selectedInterests.contains(tag)) {
        _selectedInterests.remove(tag);
      } else {
        if (_selectedInterests.length >= AppConstants.maxInterests) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('You can select up to ${AppConstants.maxInterests} interests.')),
          );
          return;
        }
        _selectedInterests.add(tag);
      }
    });
  }

  void _toggleActivity(String tag) {
    setState(() {
      if (_selectedActivities.contains(tag)) {
        _selectedActivities.remove(tag);
      } else {
        if (_selectedActivities.length >= AppConstants.maxActivityTags) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('You can select up to ${AppConstants.maxActivityTags} activities.')),
          );
          return;
        }
        _selectedActivities.add(tag);
      }
    });
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    if (_totalPhotos < AppConstants.minPhotos) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload at least 2 profile photos.')),
      );
      return;
    }

    if (_selectedBranch == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select your academic branch.')),
      );
      return;
    }

    setState(() => _isSaving = true);
    final auth = context.read<AuthProvider>();

    final body = {
      'name': _nameController.text.trim(),
      'bio': _bioController.text.trim(),
      'branch': _selectedBranch,
      'year': _selectedYear,
      'gender': _selectedGender.toApiString(),
      'interested_in': _selectedInterestedIn.toApiString(),
      'interests': _selectedInterests,
      'activity_tags': _selectedActivities,
      'active_intent': _selectedIntent.id,
      'photos': _existingPhotoUrls,
    };

    final success = await auth.updateProfile(body, newPhotos: _newPhotoFiles);
    setState(() => _isSaving = false);

    if (success && mounted) {
      if (widget.isInitialSetup) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const MainShell()),
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated successfully!')),
        );
        Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: Text(widget.isInitialSetup ? 'Create Your Campus Profile' : 'Edit Profile'),
        leading: widget.isInitialSetup
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            children: [
              // Photos Section
              Text(
                'Profile Photos (At least 2 required)',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textMain,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Add bright photos where your face is clearly visible. The first photo is your primary card photo.',
                style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 14),

              // Photos Grid (6 slots)
              _buildPhotosGrid(),

              const SizedBox(height: 24),

              // Basic Info Card
              GlassCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Full Name', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _nameController,
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 15),
                      decoration: const InputDecoration(hintText: 'Your name on campus'),
                      validator: (val) => val == null || val.trim().isEmpty ? 'Please enter your name' : null,
                    ),
                    const SizedBox(height: 16),

                    Text('Bio', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _bioController,
                      maxLines: 3,
                      maxLength: AppConstants.maxBioLength,
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                      decoration: const InputDecoration(
                        hintText: 'Share a little about yourself, your hobbies or college life…',
                      ),
                    ),
                    const SizedBox(height: 16),

                    Text('Academic Branch', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedBranch,
                      dropdownColor: AppTheme.bgCard,
                      decoration: const InputDecoration(hintText: 'Select your field of study'),
                      items: AppConstants.branches
                          .map((b) => DropdownMenuItem(value: b, child: Text(b, style: GoogleFonts.inter(fontSize: 14))))
                          .toList(),
                      onChanged: (val) => setState(() => _selectedBranch = val),
                    ),
                    const SizedBox(height: 16),

                    Text('Graduation Year', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<int>(
                      initialValue: _selectedYear,
                      dropdownColor: AppTheme.bgCard,
                      decoration: const InputDecoration(hintText: 'Expected graduation year'),
                      items: AppConstants.graduationYears
                          .map((y) => DropdownMenuItem(value: y, child: Text('$y', style: GoogleFonts.inter(fontSize: 14))))
                          .toList(),
                      onChanged: (val) => setState(() => _selectedYear = val),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Gender & Matching Preferences
              GlassCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('I am', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Row(
                      children: Gender.values.map((g) {
                        final isSel = _selectedGender == g;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: InkWell(
                              onTap: () => setState(() => _selectedGender = g),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSel ? AppTheme.primaryPink.withValues(alpha: 0.2) : AppTheme.bgSurface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSel ? AppTheme.primaryPink : AppTheme.glassBorder,
                                  ),
                                ),
                                child: Text(
                                  g.label,
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                    color: isSel ? AppTheme.primaryPink : AppTheme.textMuted,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),

                    Text('Interested In', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Row(
                      children: InterestedIn.values.map((i) {
                        final isSel = _selectedInterestedIn == i;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: InkWell(
                              onTap: () => setState(() => _selectedInterestedIn = i),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSel ? AppTheme.accentPurple.withValues(alpha: 0.2) : AppTheme.bgSurface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSel ? AppTheme.accentPurple : AppTheme.glassBorder,
                                  ),
                                ),
                                child: Text(
                                  i.label,
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                    color: isSel ? AppTheme.accentPurple : AppTheme.textMuted,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Campus Interests Section
              GlassCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Campus Interests', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                        Text('${_selectedInterests.length}/${AppConstants.maxInterests}', style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textDim)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Select up to 6 student tags to find people who share your vibe.', style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted)),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: AppConstants.predefinedInterests.map((tag) {
                        final isSel = _selectedInterests.contains(tag);
                        return FilterChip(
                          label: Text(tag),
                          selected: isSel,
                          showCheckmark: false,
                          backgroundColor: AppTheme.bgSurface,
                          selectedColor: AppTheme.primaryPink.withValues(alpha: 0.25),
                          labelStyle: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                            color: isSel ? AppTheme.primaryPink : AppTheme.textMuted,
                          ),
                          side: BorderSide(
                            color: isSel ? AppTheme.primaryPink : AppTheme.glassBorder,
                          ),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          onSelected: (_) => _toggleInterest(tag),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Activity Tags Section
              GlassCard(
                borderRadius: 20,
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Activity & Sports Tags', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                        Text('${_selectedActivities.length}/${AppConstants.maxActivityTags}', style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textDim)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Choose activities you want campus buddies for.', style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted)),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: AppConstants.predefinedActivityTags.map((tag) {
                        final isSel = _selectedActivities.contains(tag);
                        return FilterChip(
                          label: Text('⚡ $tag'),
                          selected: isSel,
                          showCheckmark: false,
                          backgroundColor: AppTheme.bgSurface,
                          selectedColor: const Color(0xFF06D6A0).withValues(alpha: 0.25),
                          labelStyle: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                            color: isSel ? const Color(0xFF06D6A0) : AppTheme.textMuted,
                          ),
                          side: BorderSide(
                            color: isSel ? const Color(0xFF06D6A0) : AppTheme.glassBorder,
                          ),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          onSelected: (_) => _toggleActivity(tag),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              GradientButton(
                text: widget.isInitialSetup ? 'Complete Profile & Enter' : 'Save Changes',
                isLoading: _isSaving,
                onPressed: _handleSave,
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhotosGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.75,
      ),
      itemCount: AppConstants.maxPhotos,
      itemBuilder: (ctx, i) {
        if (i < _existingPhotoUrls.length) {
          // Existing server photo
          final url = ApiConfig.resolvePhotoUrl(_existingPhotoUrls[i]);
          return _buildPhotoSlot(
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
            ),
            isPrimary: i == 0,
            onRemove: () => _removeExistingPhoto(i),
          );
        } else if (i < _existingPhotoUrls.length + _newPhotoFiles.length) {
          // Newly picked local file
          final fileIndex = i - _existingPhotoUrls.length;
          final file = _newPhotoFiles[fileIndex];
          return _buildPhotoSlot(
            child: Image.file(
              file,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
            ),
            isPrimary: i == 0,
            onRemove: () => _removeNewPhoto(fileIndex),
          );
        } else {
          // Empty slot with plus button
          return InkWell(
            onTap: _pickPhoto,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.bgCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.glassBorderLight, width: 1.5),
              ),
              child: const Center(
                child: Icon(Icons.add_photo_alternate_rounded, color: AppTheme.primaryPink, size: 28),
              ),
            ),
          );
        }
      },
    );
  }

  Widget _buildPhotoSlot({
    required Widget child,
    required bool isPrimary,
    required VoidCallback onRemove,
  }) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: child,
        ),
        if (isPrimary)
          Positioned(
            bottom: 6,
            left: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('Primary', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: Colors.black87,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}
