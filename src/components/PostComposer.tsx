import { useState, useEffect } from "react";
import { Lightbulb, GraduationCap, ShoppingCart, BadgeCheck, Plus, Mic, MicOff, Image, Sparkles, Link2, X, MessageSquare, UserPlus, Loader2, User, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { generatePost, generateImage } from "@/lib/ai-api";
import { getStoredPersona, clearStoredPersona, createPersonaFromProfile, type Persona } from "@/lib/persona-api";
import { linkedinApi } from "@/lib/linkedin-api";

type ContentType = "inspire" | "educate" | "sell" | "proof";

interface Topic {
  id: string;
  name: string;
  perspective?: string;
  link?: string;
}

const contentTypes = [
  { id: "inspire" as ContentType, label: "Inspire", icon: Lightbulb },
  { id: "educate" as ContentType, label: "Educate", icon: GraduationCap },
  { id: "sell" as ContentType, label: "Sell", icon: ShoppingCart },
  { id: "proof" as ContentType, label: "Proof", icon: BadgeCheck },
];

export function PostComposer() {
  const [selectedType, setSelectedType] = useState<ContentType>("inspire");
  const [topics, setTopics] = useState<Topic[]>([
    { id: "1", name: "newyear2026" },
    { id: "2", name: "Rapidscoop" },
    { id: "3", name: "Epaphara" },
    { id: "4", name: "Tamil" },
  ]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicPerspective, setNewTopicPerspective] = useState("");
  const [newTopicLink, setNewTopicLink] = useState("");
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [isRegeneratingPersona, setIsRegeneratingPersona] = useState(false);

  // Load persona on mount
  useEffect(() => {
    const stored = getStoredPersona();
    if (stored) {
      setPersona(stored);
    }
  }, []);

  const handleRegeneratePersona = async () => {
    setIsRegeneratingPersona(true);
    try {
      clearStoredPersona();
      const profile = await linkedinApi.getProfile();
      const newPersona = await createPersonaFromProfile(profile);
      setPersona(newPersona);
      toast.success("Persona regenerated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to regenerate persona");
    } finally {
      setIsRegeneratingPersona(false);
    }
  };

  // Speech-to-text hook
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    error: speechError,
  } = useSpeechToText({
    onResult: (text) => {
      setContent((prev) => prev + (prev ? " " : "") + text);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Show error toast if speech recognition fails
  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const toggleRecording = () => {
    if (isListening) {
      stopListening();
      toast.success("Recording stopped");
    } else {
      if (!isSupported) {
        toast.error("Speech recognition is not supported in your browser. Try Chrome or Edge.");
        return;
      }
      startListening();
      toast.info("Listening... Speak now");
    }
  };

  const toggleTopic = (topicId: string) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter((id) => id !== topicId));
    } else if (selectedTopics.length < 2) {
      setSelectedTopics([...selectedTopics, topicId]);
    } else {
      toast.info("You can select up to 2 topics");
    }
  };

  const addTopic = () => {
    if (!newTopicName.trim()) {
      toast.error("Please enter a topic name");
      return;
    }
    if (newTopicName.length > 50) {
      toast.error("Topic name must be 50 characters or less");
      return;
    }
    const newTopic: Topic = {
      id: Date.now().toString(),
      name: newTopicName.trim(),
      perspective: newTopicPerspective.trim() || undefined,
      link: newTopicLink.trim() || undefined,
    };
    setTopics([...topics, newTopic]);
    setNewTopicName("");
    setNewTopicPerspective("");
    setNewTopicLink("");
    setIsAddTopicOpen(false);
    toast.success("Topic added successfully");
  };

  const deleteTopic = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTopics(topics.filter((t) => t.id !== topicId));
    setSelectedTopics(selectedTopics.filter((id) => id !== topicId));
    toast.success("Topic deleted");
  };

  const resetTopicForm = () => {
    setNewTopicName("");
    setNewTopicPerspective("");
    setNewTopicLink("");
  };

  const getSelectedTopicsData = () => {
    return topics.filter((t) => selectedTopics.includes(t.id));
  };

  const getUserLinks = () => {
    return getSelectedTopicsData()
      .filter((t) => t.link)
      .map((t) => t.link as string);
  };

  const handleGeneratePost = async () => {
    if (!content.trim() && selectedTopics.length === 0) {
      toast.error("Please enter some content or select topics");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generatePost({
        action: content.trim() ? "generate" : "surprise",
        content: content.trim() || undefined,
        platform: "linkedin",
        pillar: selectedType,
        topics: getSelectedTopicsData(),
        userLinks: getUserLinks(),
        persona: persona ? JSON.stringify(persona) : null,
      });
      setGeneratedContent(result);
      toast.success("Post generated!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate post");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    const postText = generatedContent || content;
    if (!postText.trim()) {
      toast.error("Please generate or write a post first");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const result = await generateImage({
        postContent: postText,
        style: "human_enhanced",
      });
      setGeneratedImageUrl(result.imageUrl);
      toast.success("Image generated!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate image");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSurpriseMe = async () => {
    setIsGenerating(true);
    try {
      const result = await generatePost({
        action: "surprise",
        platform: "linkedin",
        pillar: selectedType,
        topics: getSelectedTopicsData(),
        userLinks: getUserLinks(),
        persona: persona ? JSON.stringify(persona) : null,
      });
      setGeneratedContent(result);
      toast.success("Surprise! Here's your post!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate surprise post");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-border/50 max-w-3xl mx-auto">
      <CardContent className="p-6 space-y-6">
        {/* Content Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-muted-foreground">Create as:</Label>
          <div className="grid grid-cols-4 gap-3">
            {contentTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all duration-200
                    ${isSelected 
                      ? "bg-foreground text-background border-foreground" 
                      : "bg-card border-border hover:border-foreground/50"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Topics Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium text-muted-foreground">
                Your Topics <span className="text-xs">(select up to 2)</span>
              </Label>
            </div>
            <Dialog open={isAddTopicOpen} onOpenChange={(open) => {
              setIsAddTopicOpen(open);
              if (!open) resetTopicForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle>Add Your Topic</DialogTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">What do you want to talk about?</p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-5 pt-4">
                  {/* Topic Name */}
                  <div className="space-y-2">
                    <Label htmlFor="topicName">Topic</Label>
                    <div className="relative">
                      <Input
                        id="topicName"
                        placeholder="e.g., AI in Healthcare, My Startup Journey, Leadership"
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value.slice(0, 50))}
                        maxLength={50}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {newTopicName.length}/50
                      </span>
                    </div>
                  </div>

                  {/* Perspective */}
                  <div className="space-y-2">
                    <Label htmlFor="perspective">Your Perspective</Label>
                    <Textarea
                      id="perspective"
                      placeholder="Share your unique angle, experiences, or key points...

Example: I recently spoke at Tamilpreneur 2025 in Chennai about bootstrapping tech startups. Share insights about the event, the energy of Tamil entrepreneurs, and lessons from my talk."
                      value={newTopicPerspective}
                      onChange={(e) => setNewTopicPerspective(e.target.value.slice(0, 1000))}
                      className="min-h-[120px] resize-none"
                      maxLength={1000}
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      {newTopicPerspective.length}/1000
                    </div>
                  </div>

                  {/* Link */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="topicLink">Link <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    </div>
                    <Input
                      id="topicLink"
                      placeholder="https://example.com/article-or-resource"
                      value={newTopicLink}
                      onChange={(e) => setNewTopicLink(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Add a link to include in your generated post</p>
                  </div>

                  {/* Pro Tip */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm">
                      <span className="font-semibold">Pro tip:</span>{" "}
                      <span className="text-muted-foreground">
                        Add recent events, personal stories, or industry insights. Your AI persona will weave these into authentic posts.
                      </span>
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => {
                      setIsAddTopicOpen(false);
                      resetTopicForm();
                    }}>
                      Cancel
                    </Button>
                    <Button onClick={addTopic}>Add Topic</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id);
              return (
                <Badge
                  key={topic.id}
                  variant={isSelected ? "default" : "outline"}
                  className={`
                    cursor-pointer px-3 py-1.5 text-sm transition-all relative pr-7 group
                    ${isSelected 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                    }
                  `}
                  onClick={() => toggleTopic(topic.id)}
                >
                  <Link2 className="h-3 w-3 mr-1.5" />
                  {topic.name}
                  <button
                    onClick={(e) => deleteTopic(topic.id, e)}
                    className={`
                      absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full flex items-center justify-center
                      opacity-0 group-hover:opacity-100 transition-opacity
                      ${isSelected 
                        ? "bg-primary-foreground text-primary" 
                        : "bg-destructive text-destructive-foreground"
                      }
                    `}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
            <button
              onClick={() => setIsAddTopicOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Text Input with Mic */}
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              placeholder="What would you like to share?"
              value={content + (interimTranscript ? (content ? " " : "") + interimTranscript : "")}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] pr-16 resize-none"
            />
            <Button
              size="icon"
              variant={isListening ? "destructive" : "default"}
              className={`absolute right-3 top-3 rounded-full h-12 w-12 ${
                isListening ? "animate-pulse" : ""
              }`}
              onClick={toggleRecording}
            >
              {isListening ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Type your idea or tap the mic to speak
          </p>
        </div>

        {/* Generated Content Display */}
        {generatedContent && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Generated Post:</Label>
            <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm">
              {generatedContent}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedContent);
                  toast.success("Copied to clipboard!");
                }}
              >
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContent(generatedContent)}
              >
                Edit
              </Button>
            </div>
          </div>
        )}

        {/* Generated Image Display */}
        {generatedImageUrl && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Generated Image:</Label>
            <div className="rounded-lg overflow-hidden border border-border">
              <img src={generatedImageUrl} alt="Generated" className="w-full h-auto" />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant={persona ? "secondary" : "outline"}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {persona ? `Persona: ${persona.name || 'Active'}` : "Create Persona"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">
                      {persona ? "Your AI Persona" : "No Persona Created"}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {persona ? "Generated from your LinkedIn profile" : "Connect LinkedIn to create your persona"}
                    </p>
                  </div>
                </div>
              </DialogHeader>
              
              {persona ? (
                <div className="space-y-4 pt-4">
                  {/* Name */}
                  {persona.name && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Name</Label>
                      <p className="text-lg font-semibold">{persona.name}</p>
                    </div>
                  )}
                  
                  {/* Headline */}
                  {persona.headline && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Headline</Label>
                      <p className="text-sm">{persona.headline}</p>
                    </div>
                  )}
                  
                  {/* Tone */}
                  {persona.tone && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tone</Label>
                      <p className="text-sm">{persona.tone}</p>
                    </div>
                  )}
                  
                  {/* Style */}
                  {persona.style && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Writing Style</Label>
                      <p className="text-sm">{persona.style}</p>
                    </div>
                  )}
                  
                  {/* Topics */}
                  {persona.topics && persona.topics.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Key Topics</Label>
                      <div className="flex flex-wrap gap-2">
                        {persona.topics.map((topic, index) => (
                          <Badge key={index} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Summary */}
                  {persona.summary && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Summary</Label>
                      <p className="text-sm text-muted-foreground">{persona.summary}</p>
                    </div>
                  )}
                  
                  {/* Raw data for debugging - show any other fields */}
                  {Object.keys(persona).filter(k => !['id', 'name', 'headline', 'tone', 'style', 'topics', 'summary'].includes(k)).length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Additional Details</Label>
                      <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-auto max-h-32">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(persona).filter(([k]) => !['id', 'name', 'headline', 'tone', 'style', 'topics', 'summary'].includes(k))
                          ),
                          null,
                          2
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRegeneratePersona}
                      disabled={isRegeneratingPersona}
                    >
                      {isRegeneratingPersona ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Regenerate
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsPersonaDialogOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                    <UserPlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No persona yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your AI persona will be automatically created when you connect your LinkedIn account.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setIsPersonaDialogOpen(false)}>
                    Got it
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button
            variant="default"
            className="bg-primary hover:bg-primary/90"
            onClick={handleGeneratePost}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Post
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
          >
            {isGeneratingImage ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Image className="h-4 w-4 mr-2" />
            )}
            Generate Image
          </Button>
          <Button
            variant="secondary"
            className="bg-foreground text-background hover:bg-foreground/90"
            onClick={handleSurpriseMe}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Surprise Me
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
