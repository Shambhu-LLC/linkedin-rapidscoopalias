import { useState, useEffect } from "react";
import { Lightbulb, GraduationCap, ShoppingCart, BadgeCheck, Plus, Mic, MicOff, Image, Sparkles, Link2, X, MessageSquare, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSpeechToText } from "@/hooks/useSpeechToText";

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
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicPerspective, setNewTopicPerspective] = useState("");
  const [newTopicLink, setNewTopicLink] = useState("");
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);

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

  const handleGenerateImage = () => {
    toast.info("Generate Image feature coming soon!");
  };

  const handleSurpriseMe = () => {
    toast.info("Surprise Me feature coming soon!");
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

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => toast.info("Create Persona feature coming soon!")}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create Persona
          </Button>
          <Button
            variant="default"
            className="bg-primary hover:bg-primary/90"
            onClick={handleGenerateImage}
          >
            <Image className="h-4 w-4 mr-2" />
            Generate Image
          </Button>
          <Button
            variant="secondary"
            className="bg-foreground text-background hover:bg-foreground/90"
            onClick={handleSurpriseMe}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Surprise Me
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
