import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../config/app_theme.dart';
import '../../config/api_config.dart';
import '../../models/user_model.dart';
import '../../models/message_model.dart';
import '../../providers/chat_provider.dart';
import '../../widgets/profile_detail_sheet.dart';

class ChatScreen extends StatefulWidget {
  final String matchId;
  final Profile? initialPartner;

  const ChatScreen({
    super.key,
    required this.matchId,
    this.initialPartner,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().openChat(
            widget.matchId,
            initialPartner: widget.initialPartner,
          );
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 80,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  void _handleSend() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    _textController.clear();
    context.read<ChatProvider>().sendMessage(text);
    Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final partner = chat.partnerProfile ?? widget.initialPartner;
    final partnerPhoto = partner != null && partner.photos.isNotEmpty
        ? ApiConfig.resolvePhotoUrl(partner.photos.first)
        : '';

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        backgroundColor: AppTheme.bgSurface,
        leadingWidth: 40,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: InkWell(
          onTap: () {
            if (partner != null) {
              ProfileDetailSheet.show(context, profile: partner);
            }
          },
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: SizedBox(
                  width: 38,
                  height: 38,
                  child: partnerPhoto.isNotEmpty
                      ? CachedNetworkImage(imageUrl: partnerPhoto, fit: BoxFit.cover)
                      : Container(color: AppTheme.bgCard, child: const Icon(Icons.person, size: 20)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      partner?.name ?? 'Match Chat',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      chat.isPartnerTyping
                          ? 'Typing…'
                          : (partner?.branch != null ? '${partner!.branch}' : 'Campus Student'),
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: chat.isPartnerTyping ? AppTheme.successGreen : AppTheme.textMuted,
                        fontWeight: chat.isPartnerTyping ? FontWeight.bold : FontWeight.normal,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline_rounded, color: AppTheme.textMuted),
            onPressed: () {
              if (partner != null) {
                ProfileDetailSheet.show(context, profile: partner);
              }
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Messages List
            Expanded(
              child: chat.isLoading && chat.messages.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      itemCount: chat.messages.length,
                      itemBuilder: (ctx, i) {
                        final msg = chat.messages[i];
                        final isMe = msg.senderId == chat.currentUserId;
                        return _buildMessageBubble(msg, isMe);
                      },
                    ),
            ),

            // Typing Indicator bubble
            if (chat.isPartnerTyping)
              Container(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.bgCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.glassBorder),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${partner?.name ?? 'Match'} is typing…',
                        style: GoogleFonts.inter(fontSize: 12, color: AppTheme.textMuted, fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                ),
              ),

            // Message Composer
            Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              decoration: const BoxDecoration(
                color: AppTheme.bgSurface,
                border: Border(top: BorderSide(color: AppTheme.glassBorder, width: 1)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      onChanged: (_) => chat.onUserTyping(),
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Type a message…',
                        filled: true,
                        fillColor: AppTheme.bgCard,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onSubmitted: (_) => _handleSend(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  InkWell(
                    onTap: _handleSend,
                    borderRadius: BorderRadius.circular(24),
                    child: Container(
                      width: 46,
                      height: 46,
                      decoration: const BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Icon(Icons.send_rounded, color: Colors.white, size: 20),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg, bool isMe) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.76),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        decoration: BoxDecoration(
          gradient: isMe ? AppTheme.primaryGradient : null,
          color: isMe ? null : AppTheme.bgCardHover,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(isMe ? 18 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 18),
          ),
          border: isMe ? null : Border.all(color: AppTheme.glassBorder),
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              msg.content,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: Colors.white,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  msg.formattedTime,
                  style: TextStyle(
                    fontSize: 10,
                    color: isMe ? Colors.white70 : AppTheme.textDim,
                  ),
                ),
                if (isMe) ...[
                  const SizedBox(width: 4),
                  if (msg.status == MessageStatus.sending)
                    const SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white70),
                    )
                  else if (msg.status == MessageStatus.failed)
                    const Icon(Icons.error_outline, size: 12, color: Colors.yellowAccent)
                  else
                    const Icon(Icons.done_all_rounded, size: 13, color: Colors.white70),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
